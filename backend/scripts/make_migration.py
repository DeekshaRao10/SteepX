"""Generate a reviewable revision by comparing metadata to the verified test DB."""

import argparse

from alembic import command
from alembic.config import Config
from alembic.operations import ops

from app.core.config import BACKEND_DIR
from scripts.local_database import confirmed_engine, test_database_name


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--revision", required=True)
    parser.add_argument("--message", required=True)
    args = parser.parse_args()
    engine = confirmed_engine(test_name=test_database_name())
    config = Config(str(BACKEND_DIR / "alembic.ini"))

    def review(_context, _revision, directives):
        def check(operation):
            if isinstance(operation, (ops.DropTableOp, ops.DropColumnOp, ops.DropConstraintOp, ops.DropIndexOp)):
                raise RuntimeError("Destructive autogeneration refused; inspect the metadata manually.")
            for child in getattr(operation, "ops", []):
                check(child)
        check(directives[0].upgrade_ops)

    try:
        with engine.connect() as connection:
            config.attributes["connection"] = connection
            command.revision(config, message=args.message, autogenerate=True,
                             rev_id=args.revision, process_revision_directives=review)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
