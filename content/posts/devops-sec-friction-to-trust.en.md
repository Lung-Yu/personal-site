---
title: "DevOps + Sec: Strong Support or Troublemakers?"
date: 2024-07-10
summary: Development and security don't have to be adversaries — adapted from talks at DevOpsDays Taipei 2024 and Digicentre's Hacker Talk.
---

The most common complaint when a company adopts a security process isn't "this tool is bad" — it's "security is slowing down our release." Behind that sentence sits a deeper problem: dev and security teams are often not on the same side.

![Left: a security gate blocking the path between dev and ship. Right: security embedded inline, moving alongside dev toward ship.](/images/diagram-friction-to-trust.svg)

## Security isn't a gate. It's a teammate.

Most organizations position security as a gatekeeper — code gets reviewed after it's written, vulnerability reports get thrown back over the wall, and everyone waits to see who blinks first. This model manufactures conflict by design: developers feel targeted, security feels ignored.

What actually works is pulling security checks earlier and making them part of the development process itself, not an extra gate at the end. SAST/DAST in CI/CD, security review at the PR stage, threat modeling baked into requirements — what these share is that security participates in building the product from day one, instead of waiting at the finish line to dock points.

## Communication is the real technical debt

Speaking at Digicentre's Hacker Talk on "Building Secure Software Starts with Effective Communication," I made an observation: most organizations don't stall on DevSecOps adoption because of tooling choices — they stall because the two teams don't share a common language. Developers don't understand why a finding is severe; security doesn't understand why the fix needs three sprints.

There's no shortcut. The fix is rewriting vulnerability reports from "here's a problem" into "here's a problem, here's why it matters, here's the lowest-cost fix" — talking about risk in terms engineers actually reason in. Only then does security get treated as a partner instead of an auditor.

## Strong support, not a troublemaker

That DevOpsDays Taipei 2024 talk closed with a 4.47/5 audience rating — the top score of the conference that year — which, in its own small way, confirmed the thesis: when a security process is designed to help you ship faster and safer, not to stop you from shipping, the friction between DevOps and Sec actually disappears.

---

Further reading: [DevOpsDays Taipei 2024 session page](https://devopsdays.tw/2024/session-page/3022) · [Full Hacker Talk write-up](https://www.ithome.com.tw/pr/156206)
