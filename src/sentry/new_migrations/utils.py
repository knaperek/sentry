from django.db import models


def drop_column_indexes(schema_editor, model, column_names, use_concurrently=True):
    """
    Drops any indexes that use all of the listed columns. Safer than specifying index
    names to drop, since indexes generated by South or manually created won't match
    the naming patterns that Django migrations use.

    use_concurrently is provided for tests, it should be left as True for most
    production use.
    """
    index_names = schema_editor._constraint_names(
        model, column_names, index=True, type_=models.indexes.Index.suffix
    )
    concurrently = "CONCURRENTLY" if use_concurrently else ""
    for index_name in index_names:
        schema_editor.execute(f'DROP INDEX {concurrently} IF EXISTS "{index_name}"')
