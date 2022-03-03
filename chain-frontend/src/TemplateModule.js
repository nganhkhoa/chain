import React, { useState, useEffect } from 'react';
import { Form, Input, Grid, Message } from 'semantic-ui-react';

import { useSubstrateState } from './substrate-lib';
import { TxButton } from './substrate-lib/components';

import { blake2AsHex } from '@polkadot/util-crypto';

export function Main(props) {
  const { api, currentAccount } = useSubstrateState();

  const [status, setStatus] = useState('');

  const [digest, setDigest] = useState(null);
  const [claim, setClaim] = useState({
    'valid': false,
    'owner': null,
    'block': null,
  });

  useEffect(() => {
    if (digest === null) {
      return;
    }

    let unsubscribe;
    api.query.templateModule
      .proofs(digest, result => {
        if (result.isEmpty) {
          setClaim({
            'valid': false,
            'owner': null,
            'block': null,
          });
          return;
        }

        let block = result.value[1].toNumber();
        let owner = result.value[0].toString();
        setClaim({
          'valid': true,
          'block': block,
          'owner': owner,
        });
      })
      .then(unsub => {
        unsubscribe = unsub;
      })
    return () => unsubscribe && unsubscribe();
  }, [digest, api.query.templateModule])

  // assert currentAccount exist
  if (currentAccount === null) return <></>;

  let fileReader;
  const bufferToDigest = () => {
    const content = Array.from(new Uint8Array(fileReader.result))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const hash = blake2AsHex(content, 256);
    setDigest(hash);
  }

  const handleFileChosen = file => {
    fileReader = new FileReader();
    fileReader.onloadend = bufferToDigest;
    fileReader.readAsArrayBuffer(file);
  }


  let isClaimed = () => {
    return claim.valid && claim.owner != null;
  }

  let canRevoke = () => {
    return isClaimed() && claim.owner === currentAccount.address;
  }

  return (
    <Grid.Column>
      <h1>Proof of Existence</h1>
      <Form success={!isClaimed()} warning={isClaimed()}>
        <Form.Field>
          <Input
            type="file"
            id="file"
            label="Your File"
            onChange={e => handleFileChosen(e.target.files[0])}
          />
          { digest === null
            ? <Message success header="No file chosen" />
            : <Message success header="File Digest Unclaimed" content={digest} />
          }
          <Message
            warning
            header="File Digest Claimed"
            list={[digest, `Owner: ${claim.owner}`, `Block: ${claim.block}`]}
          />
        </Form.Field>

        <Form.Field>
          <TxButton
            label="Create Claim"
            setStatus={setStatus}
            type="SIGNED-TX"
            disabled={isClaimed()}
            attrs={{
              palletRpc: 'templateModule',
              callable: 'createClaim',
              inputParams: [digest],
              paramFields: [true],
            }}
          />

          <TxButton
            label="Revoke Claim"
            setStatus={setStatus}
            type="SIGNED-TX"
            disabled={!canRevoke()}
            attrs={{
              palletRpc: 'templateModule',
              callable: 'revokeClaim',
              inputParams: [digest],
              paramFields: [true],
            }}
          />
        </Form.Field>
        <div style={{ overflowWrap: 'break-word' }}>{status}</div>
      </Form>
    </Grid.Column>
  )
}

export default function TemplateModule(props) {
  const { api } = useSubstrateState()
  return api.query.templateModule && api.query.templateModule.proofs ? (
    <Main {...props} />
  ) : null
}
