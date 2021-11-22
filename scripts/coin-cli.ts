import { Command } from 'commander';
import { ethers } from 'hardhat';

const program = new Command();

program
  .command('transfer')
  .description('Transferring tokens')
  .requiredOption('--tokenAddress <address>', 'Token contract address')
  .requiredOption(
    '--endpoint <endpoint>',
    'Ethereum endpoint',
    'http://localhost:8545'
  )
  .requiredOption('--senderPrivateKey <privateKey>', 'Sender private key')
  .requiredOption('--toAddress <address>', 'Receiver address')
  .requiredOption('--amount <amount>', 'Amount')
  .action(async (options) => {
    const provider = new ethers.providers.JsonRpcProvider(options.endpoint);
    const wallet = new ethers.Wallet(options.senderPrivateKey, provider);
    const contract = await ethers.getContractAt(
      'CoinBHO',
      options.tokenAddress,
      wallet
    );
    await contract.transfer(options.toAddress, options.amount);
  });

program
  .command('approve')
  .description('Approve tokens')
  .requiredOption('--tokenAddress <address>', 'Token contract address')
  .requiredOption(
    '--endpoint <endpoint>',
    'Ethereum endpoint',
    'http://localhost:8545'
  )
  .requiredOption('--senderPrivateKey <privateKey>', 'Sender private key')
  .requiredOption('--who <address>', 'Who address')
  .requiredOption('--amount <amount>', 'Amount')
  .action(async (options) => {
    const provider = new ethers.providers.JsonRpcProvider(options.endpoint);
    const wallet = new ethers.Wallet(options.senderPrivateKey, provider);
    const contract = await ethers.getContractAt(
      'CoinBHO',
      options.tokenAddress,
      wallet
    );
    await contract.approve(options.who, options.amount);
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
