# Networking Model

## Server
- Authoritative state
- Sends snapshots at fixed tick

## Client
- Predicts local movement
- Interpolates remote players

## Flow
Input → Server → Snapshot → Client render

## TODO
- Add interpolation system
- Add latency compensation
