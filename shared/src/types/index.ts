// Common type definitions shared between backend and frontend

export type UserRole = 'admin' | 'operator' | 'analyst' | 'agent_owner';

export type AgentStatus = 'online' | 'offline' | 'busy' | 'error';

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed';

export type AttackStatus = 'pending' | 'running' | 'completed' | 'failed';

export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed';

export type ResourceType = 'hash_list' | 'word_list' | 'rule_list' | 'mask_list';
