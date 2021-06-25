import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const coinBHO = await deployments.get('CoinBHO');
  const deployResult = await deploy('TokenPhaseLock', {
    from: deployer,
    args: [coinBHO.address],
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [coinBHO.address],
      },
    },
  });
};

func.tags = ['TokenPhaseLock'];
func.dependencies = ['CoinBHO'];

export default func;
