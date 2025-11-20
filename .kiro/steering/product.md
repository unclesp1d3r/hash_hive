# HashHive Product Overview

HashHive is a distributed password cracking platform that orchestrates hashcat across multiple agents in a LAN environment. It manages campaigns, attacks, and tasks while providing real-time monitoring and resource management.

**Note**: HashHive is a test/development project based on the CipherSwarm architecture and design documents.

## Core Capabilities

- **Agent Management**: Register, monitor, and coordinate distributed cracking agents with capability detection
- **Campaign Orchestration**: Create and manage multi-attack campaigns with DAG-based dependencies
- **Task Distribution**: Intelligent task assignment based on agent capabilities and keyspace partitioning
- **Resource Management**: Handle hash lists, wordlists, rulelists, and masklists with object storage
- **Real-time Monitoring**: Live dashboards for agent status, campaign progress, and crack results
- **Project Multi-tenancy**: Project-scoped access control with role-based permissions

## Target Users

- **Red Team Operators**: Efficient campaign creation and attack orchestration
- **Blue Team Analysts**: Password pattern analysis and reporting
- **Infrastructure Admins**: Resource management and system monitoring
- **Automation Tools**: RESTful APIs for n8n, MCP, and scripting integration

## Operational Context

- LAN-connected, trusted agent environment
- Single-tenant or project-scoped multi-tenant deployments
- Hashcat 6.x baseline with 7.x expansion path
- S3-compatible object storage for large artifacts
