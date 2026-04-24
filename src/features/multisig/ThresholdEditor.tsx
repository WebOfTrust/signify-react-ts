import { useMemo, useState, type ReactNode } from 'react';
import {
    Box,
    Button,
    Divider,
    IconButton,
    Stack,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { StatusPill } from '../../app/Console';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import { truncateMiddle } from '../identifiers/identifierHelpers';
import type { MultisigMemberOption } from './multisigTypes';
import {
    equalMemberWeight,
    parseThresholdSpec,
    sithSummary,
    thresholdSpecFromClauses,
    thresholdSpecForMembers,
    thresholdSpecMemberAids,
    thresholdSpecToSith,
    validateThresholdSpecForMembers,
    type MultisigThresholdClause,
    type MultisigThresholdSpec,
} from './multisigThresholds';

interface ThresholdEditorProps {
    title: string;
    memberOptions: readonly MultisigMemberOption[];
    selectedAids: string[];
    spec: MultisigThresholdSpec;
    disabled?: boolean;
    onSelectedAidsChange: (aids: string[]) => void;
    onSpecChange: (spec: MultisigThresholdSpec) => void;
}

interface SortableMemberProps {
    aid: string;
    containerId: string;
    option: MultisigMemberOption | undefined;
    weight?: string;
    onRemove?: () => void;
    onWeightChange?: (weight: string) => void;
}

const makeItemId = (containerId: string, aid: string): string =>
    `${containerId}::${aid}`;

const parseItemId = (id: string): { containerId: string; aid: string } | null => {
    const separator = id.indexOf('::');
    return separator < 0
        ? null
        : {
              containerId: id.slice(0, separator),
              aid: id.slice(separator + 2),
          };
};

const normalizeClauseWeights = (
    clause: MultisigThresholdClause
): MultisigThresholdClause => {
    const weight = equalMemberWeight(clause.weights.length);
    return {
        ...clause,
        weights: clause.weights.map((item) => ({ ...item, weight })),
    };
};

const specToClauses = (
    spec: MultisigThresholdSpec,
    selectedAids: readonly string[]
): MultisigThresholdClause[] => {
    if (spec.mode === 'nestedWeighted') {
        return spec.clauses.map((clause, index) => ({
            id: clause.id || `clause-${index + 1}`,
            weights: clause.weights.filter((item) =>
                selectedAids.includes(item.memberAid)
            ),
        }));
    }

    if (spec.mode === 'customFlat') {
        return [
            {
                id: 'clause-1',
                weights: spec.weights.filter((item) =>
                    selectedAids.includes(item.memberAid)
                ),
            },
        ];
    }

    return [
        {
            id: 'clause-1',
            weights: selectedAids.map((memberAid) => ({
                memberAid,
                weight: equalMemberWeight(selectedAids.length),
            })),
        },
    ];
};

const thresholdRawValue = (spec: MultisigThresholdSpec): string =>
    sithSummary(thresholdSpecToSith(spec));

const SortableMember = ({
    aid,
    containerId,
    option,
    weight,
    onRemove,
    onWeightChange,
}: SortableMemberProps) => {
    const id = makeItemId(containerId, aid);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({
            id,
            data: { aid, containerId },
        });

    return (
        <Box
            ref={setNodeRef}
            sx={{
                display: 'grid',
                gridTemplateColumns:
                    onWeightChange === undefined ? 'auto 1fr auto' : 'auto 1fr 88px auto',
                gap: 1,
                alignItems: 'center',
                border: 1,
                borderColor: isDragging ? 'primary.main' : 'divider',
                borderRadius: 1,
                px: 1,
                py: 0.75,
                bgcolor: 'background.paper',
                minWidth: 0,
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.72 : 1,
            }}
        >
            <Tooltip title="Drag member">
                <Box
                    component="span"
                    {...attributes}
                    {...listeners}
                    sx={{
                        display: 'inline-flex',
                        color: 'text.secondary',
                        cursor: 'grab',
                    }}
                >
                    <DragIndicatorIcon fontSize="small" />
                </Box>
            </Tooltip>
            <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {option?.alias ?? 'Unknown member'}
                    </Typography>
                    {option?.isGroup === true && (
                        <StatusPill label="group" tone="info" />
                    )}
                </Stack>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        display: 'block',
                        fontFamily: 'var(--app-mono-font)',
                        letterSpacing: 0,
                        overflowWrap: 'anywhere',
                    }}
                >
                    {truncateMiddle(aid)}
                </Typography>
            </Box>
            {onWeightChange === undefined ? (
                <StatusPill label={option?.source ?? 'member'} tone="neutral" />
            ) : (
                <TextField
                    size="small"
                    label="Weight"
                    value={weight ?? ''}
                    onChange={(event) => onWeightChange(event.target.value)}
                    slotProps={{
                        htmlInput: {
                            'aria-label': `${option?.alias ?? aid} weight`,
                        },
                    }}
                />
            )}
            {onRemove !== undefined && (
                <Tooltip title="Remove member">
                    <IconButton size="small" onClick={onRemove}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
        </Box>
    );
};

const DroppableLane = ({
    id,
    children,
}: {
    id: string;
    children: ReactNode;
}) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <Stack
            ref={setNodeRef}
            spacing={1}
            sx={{
                border: 1,
                borderColor: isOver ? 'primary.main' : 'divider',
                borderRadius: 1,
                bgcolor: isOver
                    ? 'rgba(39, 215, 255, 0.08)'
                    : 'rgba(5, 9, 13, 0.32)',
                p: 1,
                minHeight: 72,
            }}
        >
            {children}
        </Stack>
    );
};

export const ThresholdEditor = ({
    title,
    memberOptions,
    selectedAids,
    spec,
    disabled = false,
    onSelectedAidsChange,
    onSpecChange,
}: ThresholdEditorProps) => {
    const [tab, setTab] = useState<'visual' | 'manual'>('visual');
    const [manualValue, setManualValue] = useState(thresholdRawValue(spec));
    const [manualError, setManualError] = useState<string | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const clauses = useMemo(
        () => specToClauses(spec, selectedAids),
        [selectedAids, spec]
    );
    const optionByAid = useMemo(
        () => new Map(memberOptions.map((option) => [option.aid, option])),
        [memberOptions]
    );
    const availableAids = memberOptions
        .map((option) => option.aid)
        .filter((aid) => !selectedAids.includes(aid));
    const validation = validateThresholdSpecForMembers({
        spec,
        memberAids: selectedAids,
    });

    const applyClauses = (nextClauses: MultisigThresholdClause[]) => {
        const activeClauses = nextClauses.filter(
            (clause) => clause.weights.length > 0
        );
        const nextSpec =
            activeClauses.length === 0
                ? thresholdSpecForMembers([])
                : thresholdSpecFromClauses(activeClauses);
        onSpecChange(nextSpec);
        onSelectedAidsChange(thresholdSpecMemberAids(nextSpec));
        setManualValue(thresholdRawValue(nextSpec));
        setManualError(null);
    };

    const addMember = (aid: string, clauseId = clauses[0]?.id ?? 'clause-1') => {
        if (selectedAids.includes(aid)) {
            return;
        }
        const nextClauses =
            clauses.length === 0 ? [{ id: clauseId, weights: [] }] : clauses;
        applyClauses(
            nextClauses.map((clause) =>
                clause.id === clauseId
                    ? normalizeClauseWeights({
                          ...clause,
                          weights: [...clause.weights, { memberAid: aid, weight: '1' }],
                      })
                    : clause
            )
        );
    };

    const removeMember = (aid: string) => {
        applyClauses(
            clauses.map((clause) =>
                normalizeClauseWeights({
                    ...clause,
                    weights: clause.weights.filter((item) => item.memberAid !== aid),
                })
            )
        );
    };

    const addClause = () => {
        const nextIndex = clauses.length + 1;
        applyClauses([...clauses, { id: `clause-${nextIndex}`, weights: [] }]);
    };

    const removeClause = (id: string) => {
        applyClauses(clauses.filter((clause) => clause.id !== id));
    };

    const updateWeight = (clauseId: string, aid: string, weight: string) => {
        applyClauses(
            clauses.map((clause) =>
                clause.id === clauseId
                    ? {
                          ...clause,
                          weights: clause.weights.map((item) =>
                              item.memberAid === aid ? { ...item, weight } : item
                          ),
                      }
                    : clause
            )
        );
    };

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (over === null) {
            return;
        }

        const activeData =
            active.data.current as { aid?: string; containerId?: string } | undefined;
        const activeAid = activeData?.aid ?? parseItemId(String(active.id))?.aid;
        const fromId =
            activeData?.containerId ?? parseItemId(String(active.id))?.containerId;
        const overData =
            over.data.current as { aid?: string; containerId?: string } | undefined;
        const overParsed = parseItemId(String(over.id));
        const toId =
            overData?.containerId ??
            overParsed?.containerId ??
            String(over.id);

        if (activeAid === undefined || fromId === undefined || toId === 'available') {
            return;
        }

        if (fromId === 'available') {
            addMember(activeAid, toId);
            return;
        }

        if (fromId === toId) {
            const clause = clauses.find((candidate) => candidate.id === fromId);
            const overAid = overData?.aid ?? overParsed?.aid;
            if (clause === undefined || overAid === undefined || activeAid === overAid) {
                return;
            }
            const oldIndex = clause.weights.findIndex(
                (item) => item.memberAid === activeAid
            );
            const newIndex = clause.weights.findIndex(
                (item) => item.memberAid === overAid
            );
            if (oldIndex < 0 || newIndex < 0) {
                return;
            }
            applyClauses(
                clauses.map((candidate) =>
                    candidate.id === fromId
                        ? {
                              ...candidate,
                              weights: arrayMove(
                                  candidate.weights,
                                  oldIndex,
                                  newIndex
                              ),
                          }
                        : candidate
                )
            );
            return;
        }

        const moving = clauses
            .find((clause) => clause.id === fromId)
            ?.weights.find((item) => item.memberAid === activeAid);
        if (moving === undefined) {
            return;
        }
        applyClauses(
            clauses.map((clause) => {
                if (clause.id === fromId) {
                    return normalizeClauseWeights({
                        ...clause,
                        weights: clause.weights.filter(
                            (item) => item.memberAid !== activeAid
                        ),
                    });
                }
                if (clause.id === toId) {
                    return normalizeClauseWeights({
                        ...clause,
                        weights: [...clause.weights, moving],
                    });
                }
                return clause;
            })
        );
    };

    const applyManual = () => {
        const parsed = parseThresholdSpec(manualValue, selectedAids);
        if (parsed === null) {
            setManualError('Enter a number, string, weighted array, or nested array.');
            return;
        }

        const error = validateThresholdSpecForMembers({
            spec: parsed.spec,
            memberAids: selectedAids,
        });
        if (error !== null) {
            setManualError(error);
            return;
        }

        setManualError(null);
        onSpecChange(parsed.spec);
    };

    return (
        <Box
            sx={{
                border: 1,
                borderColor: validation === null ? 'divider' : 'warning.main',
                borderRadius: 1,
                p: 1.5,
                bgcolor: 'rgba(5, 9, 13, 0.35)',
            }}
        >
            <Stack spacing={1.25}>
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{
                        alignItems: { xs: 'stretch', sm: 'center' },
                        justifyContent: 'space-between',
                    }}
                >
                    <Typography variant="subtitle1">{title}</Typography>
                    <StatusPill
                        label={validation === null ? 'valid' : 'needs attention'}
                        tone={validation === null ? 'success' : 'warning'}
                    />
                </Stack>
                <Tabs
                    value={tab}
                    onChange={(_, value: 'visual' | 'manual') => {
                        if (value === 'manual') {
                            setManualValue(thresholdRawValue(spec));
                            setManualError(null);
                        }
                        setTab(value);
                    }}
                >
                    <Tab value="visual" label="Visual" />
                    <Tab value="manual" label="Manual" />
                </Tabs>
                {tab === 'visual' ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={onDragEnd}
                    >
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '0.9fr 1.2fr' },
                                gap: 1.5,
                            }}
                        >
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    Available
                                </Typography>
                                <DroppableLane id="available">
                                    <SortableContext
                                        items={availableAids.map((aid) =>
                                            makeItemId('available', aid)
                                        )}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {availableAids.length === 0 ? (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                All selected members are in this threshold.
                                            </Typography>
                                        ) : (
                                            availableAids.map((aid) => (
                                                <SortableMember
                                                    key={aid}
                                                    aid={aid}
                                                    containerId="available"
                                                    option={optionByAid.get(aid)}
                                                />
                                            ))
                                        )}
                                    </SortableContext>
                                </DroppableLane>
                            </Box>
                            <Stack spacing={1.25}>
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Typography variant="subtitle2">
                                        Required clauses
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={addClause}
                                        disabled={disabled}
                                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                                    >
                                        Clause
                                    </Button>
                                </Stack>
                                {clauses.map((clause, index) => (
                                    <Box key={clause.id}>
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            sx={{
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                mb: 0.75,
                                            }}
                                        >
                                            <Typography variant="body2">
                                                Clause {index + 1} must sum to 1
                                            </Typography>
                                            {clauses.length > 1 && (
                                                <Tooltip title="Remove clause">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            removeClause(clause.id)
                                                        }
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Stack>
                                        <DroppableLane id={clause.id}>
                                            <SortableContext
                                                items={clause.weights.map((item) =>
                                                    makeItemId(
                                                        clause.id,
                                                        item.memberAid
                                                    )
                                                )}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {clause.weights.length === 0 ? (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        Drop members into this clause.
                                                    </Typography>
                                                ) : (
                                                    clause.weights.map((item) => (
                                                        <SortableMember
                                                            key={item.memberAid}
                                                            aid={item.memberAid}
                                                            containerId={clause.id}
                                                            option={optionByAid.get(
                                                                item.memberAid
                                                            )}
                                                            weight={item.weight}
                                                            onWeightChange={(weight) =>
                                                                updateWeight(
                                                                    clause.id,
                                                                    item.memberAid,
                                                                    weight
                                                                )
                                                            }
                                                            onRemove={() =>
                                                                removeMember(
                                                                    item.memberAid
                                                                )
                                                            }
                                                        />
                                                    ))
                                                )}
                                            </SortableContext>
                                        </DroppableLane>
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                    </DndContext>
                ) : (
                    <Stack spacing={1}>
                        <TextField
                            label="Raw sith"
                            value={manualValue}
                            onChange={(event) => setManualValue(event.target.value)}
                            multiline
                            minRows={3}
                            placeholder='[["1/2","1/2"],["1"]]'
                            error={manualError !== null}
                            helperText={
                                manualError ??
                                'Enter a number, quoted string, flat weight array, or nested weight array.'
                            }
                            fullWidth
                        />
                        <Box
                            sx={{
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                p: 1,
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                Member order used by raw weighted thresholds
                            </Typography>
                            {selectedAids.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    Add members in visual mode first.
                                </Typography>
                            ) : (
                                selectedAids.map((aid, index) => (
                                    <Typography
                                        key={aid}
                                        variant="caption"
                                        sx={{
                                            display: 'block',
                                            fontFamily: 'var(--app-mono-font)',
                                            letterSpacing: 0,
                                            overflowWrap: 'anywhere',
                                        }}
                                    >
                                        {index + 1}.{' '}
                                        {optionByAid.get(aid)?.alias ?? 'Unknown'} /{' '}
                                        {aid}
                                    </Typography>
                                ))
                            )}
                        </Box>
                        <Button
                            variant="outlined"
                            onClick={applyManual}
                            disabled={disabled}
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                        >
                            Apply raw threshold
                        </Button>
                    </Stack>
                )}
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                    >
                        Serialized: {thresholdRawValue(spec)}
                    </Typography>
                </Stack>
                {validation !== null && (
                    <Typography variant="body2" color="warning.main">
                        {validation}
                    </Typography>
                )}
            </Stack>
        </Box>
    );
};
