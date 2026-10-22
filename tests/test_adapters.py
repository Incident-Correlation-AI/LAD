from __future__ import annotations

import json
from pathlib import Path

from lad.adapters.local import FileQueue, InMemoryQueue


def test_file_queue_round_trip(tmp_path):
    queue = FileQueue(tmp_path / "queue")
    queue.send([b'{"event":"a"}', b'{"event":"b"}'])
    assert queue.pending_count == 2

    handles = queue.receive(max_messages=10, visibility_timeout_s=60)
    assert len(handles) == 2
    assert json.loads(Path(handles[0].token).read_text()) == {"event": "a"}

    queue.ack(handles[0])
    assert queue.pending_count == 1

    queue.nack(handles[1], retryable=False)
    assert queue.pending_count == 0
    assert len(list((tmp_path / "queue" / "dead").glob("*.json"))) == 1
    assert not list((tmp_path / "queue").glob(".*.tmp"))


def test_file_queue_retryable_nack_keeps_message(tmp_path):
    queue = FileQueue(tmp_path / "queue")
    queue.send([b"{}"])
    handle = queue.receive(1, 60)[0]
    queue.nack(handle, retryable=True)
    assert queue.pending_count == 1


def test_in_memory_queue_dead_letters():
    queue = InMemoryQueue()
    queue.send([b"1", b"2"])
    first, second = queue.receive(2, 60)
    queue.ack(first)
    queue.nack(second, retryable=False)
    assert queue.messages == []
    assert queue.dead == [b"2"]
    assert queue.pending_count == 0
