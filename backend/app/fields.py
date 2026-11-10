"""
This module turns X-Fields requests from client
into a marshmallow ``only`` argument, so omitted
fields are neither fetched from the database nor serialized.

Unknown field names are ignored instead of raising:
the header is a hint, not a contract.
"""
import re

_TOKEN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def _parse(text, index):
    spec = {}
    length = len(text)
    while index < length:
        while index < length and text[index] in " ,\t":
            index += 1
        if index >= length or text[index] == "}":
            break
        match = _TOKEN.match(text, index)
        if match is None:
            index += 1
            continue
        name = match.group(0)
        index = match.end()
        while index < length and text[index] in " \t":
            index += 1
        sub = None
        if index < length and text[index] == "{":
            sub, index = _parse(text, index + 1)
            if index < length and text[index] == "}":
                index += 1
        spec[name] = sub
        while index < length and text[index] in " \t":
            index += 1
        if index < length and text[index] == ",":
            index += 1
    return spec, index


def _to_only(spec, prefix=""):
    paths = []
    for name, sub in spec.items():
        path = prefix + name
        if sub:
            paths.extend(_to_only(sub, path + "."))
        else:
            paths.append(path)
    return paths


def _valid_only(schema, paths):
    valid = []
    for path in paths:
        current = schema
        for part in path.split("."):
            if current is None:
                break
            field = current.fields.get(part)
            if field is None:
                break
            try:
                current = getattr(field, "schema", None)
            except Exception:
                current = None
        else:
            valid.append(path)
    return valid


def schema_for(schema_class, header):
    """Return ``schema_class`` restricted to the header fields, if any."""
    if not header:
        return schema_class()
    try:
        only = _valid_only(schema_class(), _to_only(_parse(header, 0)[0]))
    except Exception:
        return schema_class()
    return schema_class(only=only) if only else schema_class()
