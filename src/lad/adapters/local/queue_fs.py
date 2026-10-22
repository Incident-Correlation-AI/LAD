"""Directory-backed queue: one JSON file per message, with a `dead/` folder.

`receive` does not implement visibility timeouts; a message stays visible until
acked or nacked. That is acceptable for the local lane and is documented here
rather than silently pretending to be SQS.
"""

from __future__ import annotations

import os
import threading
import time
import uuid
from pathlib import Path
from typing import Sequence

from lad.ports.queue import Handle


class FileQueue:
    def __init__(self, root: Path | str) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "dead").mkdir(exist_ok=True)
        self._lock = threading.Lock()

    def send(self, messages: Sequence[bytes]) -> None:
        with self._lock:
            for message in messages:
                name = f"{time.time_ns()}-{uuid.uuid4().hex}.json"
                tmp = self.root / f".{name}.tmp"
                try:
                    # Atomic publish: a reader never sees a half-written file.
                    tmp.write_bytes(bytes(message))
                    os.replace(tmp, self.root / name)
                finally:
                    tmp.unlink(missing_ok=True)

    def receive(self, max_messages: int, visibility_timeout_s: int) -> Sequence[Handle]:
        with self._lock:
            files = sorted(p for p in self.root.glob("*.json"))
        return [Handle(str(path)) for path in files[:max_messages]]

    def ack(self, handle: Handle) -> None:
        Path(handle.token).unlink(missing_ok=True)

    def nack(self, handle: Handle, *, retryable: bool) -> None:
        path = Path(handle.token)
        if not path.exists():
            return
        if retryable:
            return
        path.rename(self.root / "dead" / path.name)

    @property
    def pending_count(self) -> int:
        return len(list(self.root.glob("*.json")))
