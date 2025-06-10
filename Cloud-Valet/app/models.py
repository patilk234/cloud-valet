from sqlalchemy import Column, Integer, String, ForeignKey, Table
from sqlalchemy.orm import relationship
from db import Base

user_group = Table(
    "user_group",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id")),
    Column("group_id", Integer, ForeignKey("groups.id")),
)

tag_vm = Table(
    "tag_vm",
    Base.metadata,
    Column("tag_id", Integer, ForeignKey("tags.id")),
    Column("vm_id", Integer, ForeignKey("vms.id")),
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)  # Added email field
    password_hash = Column(String, nullable=True)
    permission = Column(String, default="Read", nullable=False)  # New permission field
    groups = relationship("Group", secondary=user_group, back_populates="users")

class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    users = relationship("User", secondary=user_group, back_populates="groups")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    vms = relationship("VM", secondary=tag_vm, back_populates="tags")

class VM(Base):
    __tablename__ = "vms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    tags = relationship("Tag", secondary=tag_vm, back_populates="vms")
