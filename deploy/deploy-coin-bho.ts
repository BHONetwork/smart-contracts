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
  });
};

func.tags = ['CoinBHO'];

export default func;
