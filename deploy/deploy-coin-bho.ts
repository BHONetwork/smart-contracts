import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployResult = await deploy('CoinBHO', {
    from: deployer,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'CoinProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [],
        },
      },
    },
  });
};

func.tags = ['coin-bho', 'main-suite'];

export default func;
