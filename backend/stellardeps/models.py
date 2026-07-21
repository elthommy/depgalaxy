"""Pydantic models for the Stellardeps graph payloads."""

from pydantic import BaseModel, Field


class Node(BaseModel):
    """A vertex in the dependency graph (library, package, service, ...)."""

    id: str
    label: str
    kind: str = "library"
    attrs: dict = Field(default_factory=dict)


class Edge(BaseModel):
    """A directed dependency edge between two nodes."""

    source: str
    target: str
    relation: str = "depends_on"
    attrs: dict = Field(default_factory=dict)


class Containment(BaseModel):
    """A membership link: `parent` is a Pack that contains `child`."""

    parent: str
    child: str


class GraphPayload(BaseModel):
    """The full edge-list payload accepted by POST /import."""

    nodes: list[Node]
    edges: list[Edge] = Field(default_factory=list)
    containment: list[Containment] = Field(default_factory=list)
