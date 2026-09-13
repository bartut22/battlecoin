# Battlecoin Hermes Harness

This package includes a playable Battlecoin trading tutorial plus a Hermes delegation layer.

## Implemented Behaviors

- Bid Up and Bid Down control wall-to-wall territory coverage.
- The spread slider controls the ambiguous coverage band, with arrow buttons for directional adjustment.
- Four editable deck cards represent different notional deployment sizes.
- Green and red golem/balloon assets represent the two sides of the market.
- Balloon taker orders sit around each side's towers and use editable notional values.
- Capital is simulated, spend-only, and does not regenerate.
- A deposit-more button adds simulated capital.
- A tutorial pop-up explains simulated funds and includes a do-not-show-again option.
- Hermes task routing assigns card and taker jobs to agents with different model/reasoning strengths based on notional complexity.

## Run

```powershell
npm install
npm run dev
```

## Hermes

Hermes can open this project with:

```powershell
.\run-with-hermes.ps1
```
