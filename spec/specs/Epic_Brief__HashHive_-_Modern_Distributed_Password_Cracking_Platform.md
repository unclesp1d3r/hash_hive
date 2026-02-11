# Epic Brief: HashHive - Modern Distributed Password Cracking Platform

## Summary

> Note: Any mention of a specific number of cracking rigs is illustrative; HashHive targets small private-lab deployments rather than large cloud-scale setups.

HashHive is a complete reimplementation of CipherSwarm in TypeScript, providing a modern platform for managing distributed password cracking operations across multiple hashcat agents. The system orchestrates red team password cracking campaigns in a private lab environment with 7 dedicated cracking rigs, replacing the outdated Rails-based CipherSwarm with a type-safe, maintainable TypeScript stack. HashHive enables security professionals to create and monitor complex cracking campaigns, infrastructure administrators to manage agent fleets, and analysts to review results—all through a unified web dashboard with real-time updates. The platform handles campaign orchestration with DAG-based attack dependencies, intelligent task distribution across agents, resource management for hash lists and wordlists, and comprehensive monitoring of agent health and cracking progress.

### Success Criteria

- Operators can create campaigns, start/pause/stop them, and track progress/ETA
- Agents can authenticate, heartbeat, pull tasks, and report results reliably
- Resources (hash lists, wordlists, rulelists, masklists) can be uploaded/managed and reused across campaigns
- Cracked results are discoverable and attributable to campaign/attack/hash list

## Context & Problem

### Who's Affected

**Security Professionals (Red Team Operators)**

- Create and configure password cracking campaigns targeting specific hash lists
- Define multi-stage attack strategies with dependencies (e.g., dictionary → rules → mask attacks)
- Monitor campaign progress and review cracked passwords in real-time
- Need visibility into which attacks are running, completion rates, and estimated time remaining

**Infrastructure Administrators**

- Manage a fleet of dedicated cracking rigs with varying GPU capabilities
- Monitor agent health, connectivity, and hardware utilization
- Troubleshoot agent errors and performance issues
- Need to ensure optimal resource allocation and prevent idle agents

**Analysts**

- Review cracking results and analyze password patterns
- Track which hashes have been cracked and by which attack methods
- Generate reports on campaign effectiveness
- Need quick access to plaintext passwords and cracking statistics

### Current Pain Points

**Outdated Technology Stack**
The original CipherSwarm runs on Ruby on Rails with a PostgreSQL backend. As the original author, you've experienced firsthand the maintenance burden of the Rails stack: slow test suites, complex dependency management, and difficulty attracting contributors familiar with modern web development. The lack of type safety leads to runtime errors that could be caught at compile time, and the monolithic Rails architecture makes it hard to evolve individual components independently.

**Manual Coordination Overhead**
Without a centralized orchestration system, coordinating password cracking across 7 rigs requires manual intervention. Operators must manually partition keyspaces, assign work to specific agents, track which attacks have completed, and consolidate results. This manual process is error-prone (duplicate work, missed keyspace ranges) and inefficient (agents sitting idle while work is available). Complex multi-stage attacks with dependencies require careful sequencing that's difficult to manage manually.

**Limited Real-Time Visibility**
The current workflow lacks real-time feedback on campaign progress and agent status. Operators must SSH into individual rigs or parse log files to understand what's happening. There's no unified dashboard showing which agents are online, what tasks they're executing, or how close campaigns are to completion. This opacity makes it difficult to identify bottlenecks, diagnose failures, or make informed decisions about resource allocation.

### Where in the Product

This Epic encompasses the **entire HashHive platform**, including:

- **Backend API** serving both the web dashboard (session-based auth) and Go-based agents (token-based auth)
- **Web Dashboard** for campaign creation, agent monitoring, and result analysis
- **Agent Management** for registration, capability detection, heartbeat tracking, and error logging
- **Campaign Orchestration** with DAG-based attack dependencies and lifecycle management
- **Task Distribution** with intelligent keyspace partitioning and agent capability matching
- **Resource Management** for hash lists, wordlists, rulelists, and masklists
- **Real-Time Events** via WebSocket for live dashboard updates
- **Project-Based Multi-Tenancy** with role-based access control

The system operates in a **private lab environment** with a small-to-medium fleet of dedicated cracking rigs, optimized for correctness and developer experience rather than massive cloud-scale deployments.
