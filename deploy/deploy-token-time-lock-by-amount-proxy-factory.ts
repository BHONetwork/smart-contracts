import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployResult = await deploy('TokenTimeLockByAmountProxyFactory', {
    from: deployer,
    args: [],
    log: true,
  });
};

func.tags = ['token-time-lock-by-amount-proxy-factory', 'main-suite'];

export default func;
