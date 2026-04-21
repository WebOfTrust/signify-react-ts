import { describe, expect, it } from 'vitest';
import {
  createRole,
  createWitnessedIdentifier,
  exchangeAgentOobis,
  uniqueAlias,
  waitForChallenge,
} from '../support/keria';

/*
 * Challenge/response scenario.
 *
 * Two fresh witnessed roles exchange agent OOBIs, then one role responds to a
 * generated challenge and the other verifies receipt through contacts.
 */
describe.sequential('challenge response', () => {
  it(
    'exchanges OOBIs, sends a challenge response, and marks it accepted',
    async () => {
      const challenger = await createRole('challenger');
      const responder = await createRole('responder');
      const challengerAlias = uniqueAlias('challenge-alex');
      const responderAlias = uniqueAlias('challenge-rodo');
      const challengerAid = await createWitnessedIdentifier(
        challenger,
        challengerAlias
      );
      const responderAid = await createWitnessedIdentifier(
        responder,
        responderAlias
      );
      const challenge = await challenger.client.challenges().generate(128);

      await exchangeAgentOobis(
        challenger,
        challengerAlias,
        responder,
        responderAlias
      );

      await responder.client
        .challenges()
        .respond(responderAlias, challengerAid.prefix, challenge.words);

      const received = await waitForChallenge(
        challenger.client,
        responderAid.prefix,
        challenge.words
      );
      const response = await challenger.client
        .challenges()
        .responded(responderAid.prefix, received.said);

      expect(response.ok).toBe(true);
      expect(received.said).toBeTruthy();
    },
    180_000
  );
});
