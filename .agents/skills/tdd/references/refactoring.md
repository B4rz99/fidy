# Refactor Candidates

After TDD cycle, look for:

- **Duplication** → Extract pure function shared by both callers
- **Long functions** → Break into smaller pure helpers (keep tests on public interface)
- **Shallow modules** → Combine or deepen
- **Feature envy** → Move logic to where data lives
- **Primitive obsession** → Introduce immutable value types
- **Mutation** → Replace with functions that return new values (`{...obj, field: newVal}`)
- **Mixed concerns** → Separate pure logic from effects (functional core, imperative shell)
- **Implicit state** → Make it explicit as a parameter or return value
- **Existing code** the new code reveals as problematic
