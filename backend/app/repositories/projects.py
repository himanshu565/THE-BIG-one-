from sqlalchemy.orm import Session

from app.models.project import Project


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
