"""In-memory queue for tests and ephemeral local runs."""

from __future__ import annotations

import threading
import uuid
from typing import Sequence

from lad.ports.queue import Handle


class InMemoryQueue:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.messages: list[bytes] = []
        self.dead: list[bytes] = []
        self._handles: dict[str, bytes] = {}

    def send(self, messages: Sequence[bytes]) -> None:
        with self._lock:
            self.messages.extend(bytes(m) for m in messages)

    def receive(self, max_messages: int, visibility_timeout_s: int) -> Sequence[Handle]:
        with self._lock:
            batch = self.messages[:max_messages]
            handles = []
            for message in batch:
                token = uuid.uuid4().hex
                self._handles[token] = message
                handles.append(Handle(token))
            self.messages = self.messages[max_messages:]
            return handles

    def ack(self, handle: Handle) -> None:
        with self._lock:
            self._handles.pop(handle.token, None)

    def nack(self, handle: Handle, *, retryable: bool) -> None:
        with self._lock:
            message = self._handles.pop(handle.token, None)
            if message is None:
                return
            if retryable:
                self.messages.append(message)
            else:
                self.dead.append(message)

    @property
    def pending_count(self) -> int:
        with self._lock:
            return len(self.messages) + len(self._handles)
