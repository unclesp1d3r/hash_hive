# HashHive Product Overview

HashHive is a distributed password cracking platform that orchestrates hashcat across multiple agents in a LAN environment. It manages campaigns, attacks, and tasks while providing real-time monitoring and resource management.

**Context**: HashHive is a 2026 TypeScript reimplementation of [CipherSwarm](https://github.com/unclesp1d3r/CipherSwarm), serving as both a functional tool and a technology evaluation exercise. It runs in a private lab environment managing 7 cracking rigs.

## Core Capabilities

- **Agent Management**: Register, monitor, and coordinate distributed cracking agents with capability detection
- **Campaign Orchestration**: Create and manage multi-attack campaigns with DAG-based dependencies
- **Task Distribution**: Intelligent task assignment based on agent capabilities and keyspace partitioning
- **Resource Management**: Handle hash lists, wordlists, rulelists, and masklists
- **Real-time Monitoring**: Live dashboards for agent status, campaign progress, and crack results
- **Project Multi-tenancy**: Project-scoped access control with role-based permissions

## Target Users

- **Red Team Operators**: Efficient campaign creation and attack orchestration
- **Blue Team Analysts**: Password pattern analysis and reporting
- **Infrastructure Admins**: Resource management and system monitoring

## Operational Context

- **Private lab environment**: 7 cracking rigs, not publicly exposed
- **Low sustained load**: Periodic bursts when rigs submit results, request work, and send heartbeats
- **Low-traffic Dashboard**: 1-3 concurrent human users monitoring progress
- **LAN-connected agents**: Trusted agent environment
- **Hashcat compatibility**: 6.x baseline with 7.x expansion path
- **Optimize for**: Correctness, clarity, and developer experience (not premature scale)

## Reference Implementation

CipherSwarm's architecture, data models, and agent communication patterns are the source of truth for functional requirements. The Go-based hashcat-agent is the primary API consumer.
