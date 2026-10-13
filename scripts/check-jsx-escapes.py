#!/usr/bin/env python3
"""Find \\uXXXX sitting in JSX TEXT, where it renders as six literal characters.

Inside a string or template literal the escape is processed by the compiler and
is fine; in a comment it is invisible. Only bare JSX text is a bug. This has now
shipped three times, so the detection needs to be the careful part: strip
comments, then template literals (greedily, because they nest), then quoted
strings, and look at whatever text is left.
"""
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "src")


def strip(line: str) -> str:
    line = re.sub(r"/\*.*?\*/", "", line)          # block comment on one line
    line = re.sub(r"//.*$", "", line)              # line comment
    line = re.sub(r"^\s*\*.*$", "", line)          # continuation of a doc block
    line = re.sub(r"`.*`", "", line)               # template literals, incl. nested
    line = re.sub(r'"[^"]*"', "", line)
    line = re.sub(r"'[^']*'", "", line)
    # A line still holding `${` is the middle of a template literal that opened
    # on an earlier line, so the escape is in string context after all.
    if "${" in line:
        return ""
    return line


bad = []
for f in sorted(root.rglob("*.tsx")):
    in_comment = False
    for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
        # {/* ... */} JSX comments routinely span lines; everything inside one
        # is invisible on the page, escape or not.
        opened = "{/*" in line or "/*" in re.sub(r"/\*.*?\*/", "", line)
        if in_comment:
            if "*/" in line:
                in_comment = False
            continue
        if opened and "*/" not in line.split("/*", 1)[1]:
            in_comment = True
            continue
        if re.search(r"\\u[0-9a-fA-F]{4}", strip(line)):
            bad.append(f"{f}:{n}: {line.strip()[:110]}")

if bad:
    print(f"{len(bad)} literal \\uXXXX in JSX text:")
    for b in bad:
        print("  " + b)
    sys.exit(1)
print("No literal \\uXXXX in JSX text.")
