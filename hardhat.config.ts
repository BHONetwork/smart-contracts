import { task, HardhatUserConfig } from 'hardhat/config';
import 'tsconfig-paths/register';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-solhint';
import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-ethers';

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
  solidity: '0.8.4',
  networks: {
    'bsc-testnet': {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      accounts: [
        'f9d9825fbbe2e707b105f8aa17635da2ae1bc6e77279f9983e2770bf86f02e45',
      ],
    },
  },
};

export default config;
