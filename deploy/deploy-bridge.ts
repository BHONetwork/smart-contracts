import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, log } = deployments;
  const { deployer, bridgeAdmin } = await getNamedAccounts();
  const deployment = await deployments.get('CoinBHO');
  const serviceFee = ethers.BigNumber.from('1000000000000000');
  const minDeposit = ethers.BigNumber.from('10000000000000000');

  const deployResult = await deploy('Bridge', {
    from: deployer,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'BridgeProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [bridgeAdmin, deployment.address, serviceFee, minDeposit],
        },
      },
    },
  });
  /* const bridgeContract = await ethers.getContract('Bridge_Implementation');
  await bridgeContract.initialize(bridgeAdmin, deployment.address, serviceFee); */
};

func.tags = ['bridge', 'main-suite'];
func.dependencies = ['coin-bho'];
export default func;
