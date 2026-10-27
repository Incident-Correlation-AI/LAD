"""Amazon SQS adapter for QueuePort."""

from __future__ import annotations

import os
from typing import Any, Sequence

import boto3

from lad.ports.queue import Handle


class SQSQueue:
    """SQS-backed queue implementation of QueuePort."""

    def __init__(
        self,
        queue_url: str,
        *,
        client: Any = None,
        dlq_url: str | None = None,
        region_name: str | None = None,
    ) -> None:
        self.queue_url = queue_url
        self.dlq_url = dlq_url or os.environ.get("DLQ_URL")
        self.region_name = region_name or os.environ.get("AWS_REGION", "eu-north-1")
        self.client = client or boto3.client("sqs", region_name=self.region_name)
        self._cache: dict[str, tuple[str, bytes]] = {}

    def send(self, messages: Sequence[bytes]) -> None:
        """Send a sequence of messages in batches of up to 10 (SQS limit)."""
        if not messages:
            return

        # SQS send_message_batch allows at most 10 messages per request
        batch_size = 10
        for i in range(0, len(messages), batch_size):
            chunk = messages[i : i + batch_size]
            entries = []
            for idx, msg in enumerate(chunk):
                body = msg.decode("utf-8") if isinstance(msg, (bytes, bytearray)) else str(msg)
                entries.append({"Id": str(idx), "MessageBody": body})

            response = self.client.send_message_batch(QueueUrl=self.queue_url, Entries=entries)
            failed = response.get("Failed", [])
            if failed:
                first = failed[0]
                raise RuntimeError(
                    f"SQS send_message_batch failed for {len(failed)} message(s): "
                    f"code={first.get('Code')} message={first.get('Message')}"
                )

    def receive(self, max_messages: int = 10, visibility_timeout_s: int = 30) -> Sequence[Handle]:
        """Receive up to 10 messages from SQS and return handles."""
        max_batch = min(max(1, max_messages), 10)
        response = self.client.receive_message(
            QueueUrl=self.queue_url,
            MaxNumberOfMessages=max_batch,
            VisibilityTimeout=visibility_timeout_s,
            AttributeNames=["All"],
            MessageAttributeNames=["All"],
        )
        handles: list[Handle] = []
        for msg in response.get("Messages", []):
            receipt_handle = msg["ReceiptHandle"]
            body = msg.get("Body", "").encode("utf-8")
            token = msg.get("MessageId", receipt_handle)
            self._cache[token] = (receipt_handle, body)
            handles.append(Handle(token=token))
        return handles

    def get_body(self, handle: Handle) -> bytes | None:
        """Retrieve cached body for a received handle."""
        entry = self._cache.get(handle.token)
        return entry[1] if entry else None

    def ack(self, handle: Handle) -> None:
        """Delete message from SQS upon successful processing."""
        entry = self._cache.pop(handle.token, None)
        receipt_handle = entry[0] if entry else handle.token
        self.client.delete_message(QueueUrl=self.queue_url, ReceiptHandle=receipt_handle)

    def nack(self, handle: Handle, *, retryable: bool) -> None:
        """Handle failure: make visible immediately if retryable, or push to DLQ if non-retryable."""
        entry = self._cache.pop(handle.token, None)
        receipt_handle = entry[0] if entry else handle.token

        if retryable:
            # Setting visibility timeout to 0 makes it immediately available to retrying workers
            self.client.change_message_visibility(
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt_handle,
                VisibilityTimeout=0,
            )
        else:
            if self.dlq_url and entry:
                # Explicit dead-letter send if DLQ URL is configured
                self.client.send_message(
                    QueueUrl=self.dlq_url,
                    MessageBody=entry[1].decode("utf-8"),
                )
                self.client.delete_message(
                    QueueUrl=self.queue_url,
                    ReceiptHandle=receipt_handle,
                )
            # If no dlq_url is set, SQS redrive policy handles it after maxReceiveCount
