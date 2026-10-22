from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence


@dataclass(frozen=True)
class Handle:
    """Opaque queue handle. Local adapters typically store a file path."""

    token: str


class QueuePort(Protocol):
    """Buffers accepted events between ingestion and the worker."""

    def send(self, messages: Sequence[bytes]) -> None: ...

    def receive(self, max_messages: int, visibility_timeout_s: int) -> Sequence[Handle]: ...

    def ack(self, handle: Handle) -> None: ...

    def nack(self, handle: Handle, *, retryable: bool) -> None: ...
