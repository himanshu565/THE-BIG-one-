from sqlalchemy.orm import Session

from app.models.project import Project

_UNSET = object()


def create_project(
    db: Session,
    *,
    name: str,
    description: str | None,
    owner_id: int,
) -> Project:
    """Persist a project and return the refreshed entity."""
    project = Project(name=name, description=description, owner_id=owner_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def list_projects(db: Session, *, owner_id: int | None = None) -> list[Project]:
    """Return projects, optionally scoped to an owner."""
    query = db.query(Project)
    if owner_id is not None:
        query = query.filter(Project.owner_id == owner_id)
    return query.order_by(Project.created_at.desc(), Project.id.desc()).all()


def get_project(db: Session, *, project_id: int) -> Project | None:
    """Return one project by its identifier."""
    return db.get(Project, project_id)


def update_project(
    db: Session,
    *,
    project_id: int,
    name: str | None = None,
    description: str | None | object = _UNSET,
) -> Project | None:
    """Update supplied project fields and return the refreshed entity."""
    project = db.get(Project, project_id)
    if project is None:
        return None
    if name is not None:
        project.name = name
    if description is not _UNSET:
        project.description = description
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, *, project_id: int) -> bool:
    """Delete a project and report whether it existed."""
    project = db.get(Project, project_id)
    if project is None:
        return False
    db.delete(project)
    db.commit()
    return True
