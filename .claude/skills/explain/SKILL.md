---
name: explain
description: Explain a concept, file or feature of the movieTicket app clearly. Invoke with /explain <topic>.
argument-hint: <topic, file or feature>
disable-model-invocation: true
---

Explain the following topic in simple terms, for someone new to this codebase.

**Topic:** $ARGUMENTS

1. Say in 2–3 sentences what it is and why it exists.
2. Give one everyday analogy (e.g. a cinema box office).
3. If it exists in this project, find the code (start from Code Layout in CLAUDE.md) and walk through how it works step by step, linking `file:line`. Otherwise show one short TypeScript example.
4. Name the business rules from CLAUDE.md it enforces, if any.
5. End with **Try it yourself**: one small experiment or test to deepen understanding.

Don't change any code.
