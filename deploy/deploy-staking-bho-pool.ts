import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer, feeCollector, defaultAdmin } = await getNamedAccounts();
  const coinDeployment = await deployments.get('CoinBHO');
  const stakingDeployment = await deploy('StakingBHOPool', {
    from: deployer,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'StakingBHOPoolProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [defaultAdmin, coinDeployment.address, feeCollector],
        },
      },
    },
  });
};

func.tags = ['staking-bho-pool', 'main-suite'];
func.dependencies = ['coin-bho'];

export default func;
