import { ethers } from 'hardhat';

export async function latestBlockTimestamp(): Promise<number> {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

export function daysToSeconds(day: number): number {
  return day * 60 * 60 * 24;
}
