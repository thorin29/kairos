#!/usr/bin/env python3
"""Flag reads of a field a Prisma `select` did not ask for.

This sandbox cannot generate the Prisma client, so every query result is `any`
here and `obj.whatever` typechecks locally no matter what. The Docker build,
which does generate it, is the first place the mistake appears — it has now cost
two builds (TS2538 on a nullable muscle, and `task.id` on a select that only
asked for userId).

Deliberately conservative: only `const x = await prisma.m.findUnique/findFirst({
... })` with a single flat `select { ... }`, and only property reads on `x`
inside the same function body. Nested selects, spreads and casts are skipped
rather than guessed at, so a clean run is weak evidence, but a hit is nearly
always real.
"""
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "src")

JS_PROPS = {"length", "map", "filter", "forEach", "find", "then", "catch", "at",
            "slice", "some", "every", "reduce", "toString", "valueOf"}

DECL = re.compile(
    r"const\s+(\w+)\s*=\s*\(?\s*await\s+prisma\.(\w+)\.(findUnique|findFirst)\s*\(\s*\{",
)


def balanced(text: str, start: int) -> str:
    """The {...} starting at `start` (index of the opening brace)."""
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return ""


bad = []
for f in sorted(root.rglob("*.ts")):
    if "generated" in f.parts:
        continue
    src = f.read_text(encoding="utf-8")
    # Blank out comments but keep offsets, so a comment that mentions a field
    # name doesn't read as code (this script flagged its own comment once).
    src = re.sub(r"//[^\n]*", lambda m: " " * len(m.group(0)), src)
    src = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), src, flags=re.S)
    for m in DECL.finditer(src):
        var = m.group(1)
        args = balanced(src, m.end() - 1)
        if not args:
            continue
        sm = re.search(r"\bselect:\s*\{", args)
        if not sm:
            continue  # no select means the whole row; nothing to check
        sel = balanced(args, sm.end() - 1)
        # A nested select means relations are involved; too easy to misread.
        inner = sel[1:-1]
        # A spread pulls in keys defined elsewhere; we cannot know them, so this
        # query is not checkable rather than wrongly flagged.
        if "..." in inner:
            continue
        keys = set(re.findall(r"(\w+)\s*:", inner))
        # Stop at the next declaration of the same name, so two queries sharing
        # a variable name don't check each other's fields.
        after = src[m.end() : m.end() + 4000]
        # Stop at any rebinding of the name, including a loop variable that
        # shadows it — `for (const session of sessions)` is a different thing
        # from the `session` this query returned.
        nxt = re.search(
            rf"(const\s+{re.escape(var)}\s*=|for\s*\(\s*const\s+{re.escape(var)}\s+of)",
            after,
        )
        if nxt:
            after = after[: nxt.start()]
        # The lookbehind keeps `prisma.task.update(...)` from reading as a
        # property access on a variable that happens to be called `task`.
        for pm in re.finditer(rf"(?<![\w.]){re.escape(var)}\??\.(\w+)", after):
            prop = pm.group(1)
            if prop in keys or prop in JS_PROPS:
                continue
            line = src[: m.end() + pm.start()].count("\n") + 1
            bad.append(
                f"{f}:{line}: {var}.{prop} — select asks for "
                f"{', '.join(sorted(keys)) or '(nothing)'}"
            )

if bad:
    print(f"{len(bad)} read(s) of an unselected field:")
    for b in dict.fromkeys(bad):
        print("  " + b)
    sys.exit(1)
print("No reads of unselected Prisma fields.")
