// Common type definitions shared between backend and frontend

export type UserRole = 'admin' | 'operator' | 'analyst' | 'agent_owner';

export type AgentStatus = 'online' | 'offline' | 'busy' | 'error';

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed';

export type AttackStatus = 'pending' | 'running' | 'completed' | 'failed';

export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed';

export type ResourceType = 'hash_list' | 'word_list' | 'rule_list' | 'mask_list';

// Authentication types
export interface User {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled';
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  roles?: string[];
}

export interface AuthTokenPayload {
  userId: string;
  roles: string[];
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface SessionData {
  userId: string;
  createdAt: Date;
}
