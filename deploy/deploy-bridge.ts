import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, log } = deployments;
  const { deployer, bridgeAdmin } = await getNamedAccounts();
  const deployment = await deployments.get('CoinBHO')
  const deployResult = await deploy('Bridge', {
    from: deployer,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'BridgeProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [bridgeAdmin, deployment.address, 1000_000_000],
        },
      },
    },
  });
  const bridgeContract = await ethers.getContract('Bridge_Implementation')
  await bridgeContract.initialize(bridgeAdmin, deployment.address, 1000_000_000)
};

func.tags = ['bridge', 'main-suite'];
func.dependencies = ['coin-bho']
export default func;
