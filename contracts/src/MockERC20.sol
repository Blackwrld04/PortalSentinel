// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IGuardianRevocable } from "./DefenseExecutor.sol";

/**
 * @title MockERC20
 * @notice Test token for Portaldot V3 testnet demonstration.
 *         Supports public minting for testing and guardian-aware direct revocation.
 */
contract MockERC20 is ERC20, Ownable, IGuardianRevocable {
    address public guardianExecutor;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function setGuardianExecutor(address _executor) external onlyOwner {
        require(_executor != address(0), "MockERC20: Invalid executor address");
        guardianExecutor = _executor;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Allows the designated guardian contract to zero out an allowance directly.
     * @dev No zero-address bypass: only the configured executor may revoke.
     */
    function guardianRevokeApproval(address owner, address spender) external override {
        require(
            msg.sender == guardianExecutor,
            "MockERC20: Caller not authorized guardian executor"
        );
        _approve(owner, spender, 0);
    }
}
