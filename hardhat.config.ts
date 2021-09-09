import { task, HardhatUserConfig } from 'hardhat/config';
import * as dotenv from 'dotenv';
import 'tsconfig-paths/register';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-solhint';
import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.4',
  },
  gasReporter: {
    currency: 'USD',
    coinmarketcap: '6932a382-08a0-41ef-86c7-2773dd0bd2f0',
    gasPrice: 10,
    // @ts-ignore
    ethPrice: 300,
  },
  networks: {
    localhost: {
      saveDeployments: false,
      live: false,
    },
    'bsc-testnet': {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      accounts: [process.env.BSC_TESTNET_DEPLOYER_PRIVATE_KEY as string],
      live: true,
      tags: ['staging'],
      chainId: 97,
    },
    'bsc-mainnet': {
      url: 'https://bsc-dataseed.binance.org/',
      accounts: [process.env.BSC_MAINNET_DEPLOYER_PRIVATE_KEY as string],
      live: true,
      chainId: 56,
    },
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY,
  },
  namedAccounts: {
    deployer: 0,
    feeCollector: {
      default: 1,
      'bsc-testnet': process.env.BSC_TESTNET_FEE_COLLECTOR_ADDRESS as string,
      'bsc-mainnet': process.env.BSC_MAINNET_FEE_COLLECTOR_ADDRESS as string,
    },
    defaultAdmin: {
      default: 2,
      'bsc-testnet': process.env.BSC_TESTNET_DEFAULT_ADMIN_ADDRESS as string,
      'bsc-mainnet': process.env.BSC_MAINNET_DEFAULT_ADMIN_ADDRESS as string,
    },
    alice: 3,
  },
};

export default config;
