import 'tsconfig-paths';

import { Command } from 'commander';
import { Keyring } from '@polkadot/keyring';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';

const program = new Command();

const getBridgeContract = async (
  address: string,
  endpoint: string,
  privateKey: string
): Promise<Contract> => {
  const provider = new ethers.providers.JsonRpcProvider(endpoint);
  const wallet = new ethers.Wallet(privateKey, provider);
  const bridgeContract = await ethers.getContractAt('Bridge', address, wallet);

  return bridgeContract;
};

program
  .command('initiate-transfer')
  .description('Initiate crosschain transfer')
  .requiredOption('--endpoint <endpoint>', 'Endpoint', 'http://localhost:8545')
  .requiredOption('--bridgeAddress <address>', 'Bridge contract address')
  .requiredOption(
    '--senderPrivateKey <privateKey>',
    'Sender private key to sign transaction'
  )
  .requiredOption(
    '--toAddress <ss58Address>',
    "Receiver's ss58 address on bholdus"
  )
  .requiredOption('--chain <id>', 'Chain ID', '0')
  .requiredOption('--amount <amount>', 'Amount')
  .action(async (options) => {
    const keyring = new Keyring({ type: 'sr25519' });
    const toAddressBytes = keyring.decodeAddress(options.toAddress);
    const provider = new ethers.providers.JsonRpcProvider(options.endpoint);
    const wallet = new ethers.Wallet(options.senderPrivateKey, provider);
    const bridgeContract = await ethers.getContractAt(
      'Bridge',
      options.bridgeAddress,
      wallet
    );

    const serviceFee = await bridgeContract.serviceFee();

    await bridgeContract.initiateTransfer(
      toAddressBytes,
      ethers.BigNumber.from(options.amount),
      parseInt(options.chain),
      { value: serviceFee }
    );
  });

program
  .command('register-chain')
  .description('Register chain')
  .requiredOption('--endpoint <endpoint>', 'Endpoint', 'http://localhost:8545')
  .requiredOption('--bridgeAddress <address>', 'Bridge contract address')
  .requiredOption(
    '--senderPrivateKey <privateKey>',
    'Sender private key to sign transaction'
  )
  .requiredOption('--chain <id>', 'chain')
  .action(async (options) => {
    const bridgeContract = await getBridgeContract(
      options.bridgeAddress,
      options.endpoint,
      options.senderPrivateKey
    );

    await bridgeContract.forceRegisterChain(options.chain);
  });

program
  .command('register-relayer')
  .description('Register relayer')
  .requiredOption('--endpoint <endpoint>', 'Endpoint', 'http://localhost:8545')
  .requiredOption('--bridgeAddress <address>', 'Bridge contract address')
  .requiredOption(
    '--senderPrivateKey <privateKey>',
    'Sender private key to sign transaction'
  )
  .requiredOption('--relayerAddress <address>', 'Relayer address')
  .action(async (options) => {
    const bridgeContract = await getBridgeContract(
      options.bridgeAddress,
      options.endpoint,
      options.senderPrivateKey
    );

    await bridgeContract.forceRegisterRelayer(options.relayerAddress);
  });

async function main() {
  await program.parseAsync(process.argv);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
