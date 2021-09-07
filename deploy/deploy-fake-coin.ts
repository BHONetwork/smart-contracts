import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy('FakeBHO', {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy('FakeBNB', {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy('FakeDOT', {
    from: deployer,
    args: [],
    log: true,
  });
};

func.tags = ['fake-coin'];

export default func;
