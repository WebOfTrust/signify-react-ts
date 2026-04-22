export interface SediVoterIssueFormDraft {
    fullName: string;
    voterId: string;
    precinctId: string;
    county: string;
    jurisdiction: string;
    electionId: string;
    eligible: boolean;
    expires: string;
}

export type SediVoterIssueTextFieldKey = Exclude<
    keyof SediVoterIssueFormDraft,
    'eligible'
>;

export const SEDI_VOTER_ISSUE_TEXT_FIELDS: readonly {
    key: SediVoterIssueTextFieldKey;
    label: string;
}[] = [
    { key: 'fullName', label: 'Full name' },
    { key: 'voterId', label: 'Voter id' },
    { key: 'precinctId', label: 'Precinct' },
    { key: 'county', label: 'County' },
    { key: 'jurisdiction', label: 'Jurisdiction' },
    { key: 'electionId', label: 'Election' },
    { key: 'expires', label: 'Expires' },
];

const requiredFieldLabels: Record<SediVoterIssueTextFieldKey, string> = {
    fullName: 'Full name',
    voterId: 'Voter id',
    precinctId: 'Precinct',
    county: 'County',
    jurisdiction: 'Jurisdiction',
    electionId: 'Election',
    expires: 'Expires',
};

export type SediVoterIssueFormErrors = Partial<
    Record<SediVoterIssueTextFieldKey, string>
>;

export const validateSediVoterIssueDraft = (
    draft: SediVoterIssueFormDraft
): SediVoterIssueFormErrors => {
    const errors: SediVoterIssueFormErrors = {};

    for (const key of Object.keys(requiredFieldLabels) as SediVoterIssueTextFieldKey[]) {
        if (draft[key].trim().length === 0) {
            errors[key] = `${requiredFieldLabels[key]} is required.`;
        }
    }

    if (
        errors.expires === undefined &&
        !Number.isFinite(Date.parse(draft.expires.trim()))
    ) {
        errors.expires = 'Expires must be an ISO date time.';
    }

    return errors;
};

export const hasSediVoterIssueDraftErrors = (
    errors: SediVoterIssueFormErrors
): boolean => Object.keys(errors).length > 0;
