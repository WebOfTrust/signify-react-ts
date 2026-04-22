import type { MultisigThresholdSpec } from './multisigThresholds';

export type MultisigGroupStatus =
    | 'draft'
    | 'proposed'
    | 'joining'
    | 'incepting'
    | 'authorizingAgents'
    | 'active'
    | 'interacting'
    | 'rotating'
    | 'failed';

export interface MultisigMemberDraft {
    aid: string;
    alias: string;
    source: 'local' | 'contact' | 'manual';
    isGroup?: boolean;
    deliveryStatus?:
        | 'local'
        | 'ready'
        | 'missingAgentOobi'
        | 'unresolvedContact'
        | 'missingKeyState';
}

export interface MultisigMemberOption {
    aid: string;
    alias: string;
    source: 'local' | 'contact';
    isGroup: boolean;
    isLocal: boolean;
    localName?: string;
    deliveryStatus:
        | 'local'
        | 'ready'
        | 'missingAgentOobi'
        | 'unresolvedContact'
        | 'missingKeyState';
}

export interface MultisigCreateDraft {
    groupAlias: string;
    localMemberName: string;
    localMemberAid: string;
    members: MultisigMemberDraft[];
    signingMemberAids: string[];
    rotationMemberAids: string[];
    signingThreshold: MultisigThresholdSpec;
    rotationThreshold: MultisigThresholdSpec;
    witnessMode: 'none' | 'demo';
}

export interface MultisigInteractionDraft {
    groupAlias: string;
    localMemberName?: string | null;
    data: unknown;
}

export interface MultisigRotationDraft {
    groupAlias: string;
    localMemberName?: string | null;
    signingMemberAids: string[];
    rotationMemberAids: string[];
    nextThreshold: MultisigThresholdSpec;
}

export interface MultisigRequestActionInput {
    notificationId?: string | null;
    exnSaid: string;
    groupAlias: string;
    localMemberName: string;
}

export interface MultisigOperationResult {
    groupAlias: string;
    groupAid: string | null;
    localMemberAid: string | null;
    exchangeSaid: string | null;
    operationNames: string[];
    completedAt: string;
}
