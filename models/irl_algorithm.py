"""
Maximum Entropy Inverse Reinforcement Learning (MaxEnt IRL) implementation.
Learns reward function that explains expert behavior.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
from typing import List, Tuple, Dict
from tqdm import tqdm

from models.reward_model import RewardModel, PolicyNetwork


class ExpertTrajectoryDataset(Dataset):
    """
    Dataset for expert trajectories (your observed behavior).
    Each trajectory is a sequence of (state, action) pairs.
    """
    
    def __init__(self, trajectories: List[List[Tuple[np.ndarray, np.ndarray]]]):
        """
        Initialize dataset.
        
        Args:
            trajectories: List of trajectories, each is list of (state, action) tuples
        """
        self.states = []
        self.actions = []
        
        # Flatten trajectories
        for trajectory in trajectories:
            for state, action in trajectory:
                self.states.append(state)
                self.actions.append(action)
        
        self.states = np.array(self.states)
        self.actions = np.array(self.actions)
    
    def __len__(self):
        return len(self.states)
    
    def __getitem__(self, idx):
        state = torch.FloatTensor(self.states[idx])
        action = torch.FloatTensor(self.actions[idx])
        return state, action


class MaxEntIRL:
    """
    Maximum Entropy IRL algorithm.
    
    Goal: Learn reward function R(s, a) such that your behavior
    is optimal under that reward function.
    
    Algorithm:
    1. Initialize reward model R(s, a)
    2. Compute optimal policy π*(a|s) given R
    3. Compare expert behavior vs policy behavior
    4. Update R to maximize likelihood of expert behavior
    5. Repeat until convergence
    """
    
    def __init__(
        self,
        state_dim: int = 192,
        action_dim: int = 48,
        learning_rate: float = 0.001,
        device: str = None
    ):
        """
        Initialize MaxEnt IRL.
        
        Args:
            state_dim: Dimension of state vector
            action_dim: Dimension of action vector
            learning_rate: Learning rate for optimization
            device: Device to use ('cuda' or 'cpu')
        """
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.learning_rate = learning_rate
        
        # Set device
        if device is None:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = torch.device(device)
        
        print(f"Using device: {self.device}")
        
        # Initialize reward model
        self.reward_model = RewardModel(state_dim, action_dim).to(self.device)
        
        # Initialize policy network (for computing optimal policy)
        self.policy = PolicyNetwork(state_dim, action_dim).to(self.device)
        
        # Optimizers
        self.reward_optimizer = optim.Adam(
            self.reward_model.parameters(),
            lr=learning_rate,
            weight_decay=1e-5
        )
        
        self.policy_optimizer = optim.Adam(
            self.policy.parameters(),
            lr=learning_rate * 0.1,  # Slower learning for policy
            weight_decay=1e-5
        )
        
        # Loss function
        self.criterion = nn.MSELoss()
    
    def compute_optimal_policy(self, states: torch.Tensor, num_iterations: int = 10) -> PolicyNetwork:
        """
        Compute optimal policy π*(a|s) given current reward function.
        
        Uses policy gradient to find policy that maximizes expected reward.
        
        Args:
            states: Batch of states [batch_size, state_dim]
            num_iterations: Number of policy optimization steps
            
        Returns:
            Updated policy network
        """
        self.policy.train()
        
        for _ in range(num_iterations):
            # Sample actions from current policy
            action_probs = self.policy(states)
            
            # Compute expected reward for each state-action pair
            # (This is simplified - full implementation would use value iteration)
            rewards = []
            for i in range(states.size(0)):
                state = states[i:i+1]
                # Sample multiple actions and compute average reward
                sampled_actions = []
                for _ in range(10):  # Sample 10 actions
                    action_idx = self.policy.sample_action(state)
                    # Convert action index to action vector (simplified)
                    action_vec = torch.zeros(self.action_dim)
                    action_vec[action_idx] = 1.0
                    sampled_actions.append(action_vec)
                
                # Compute average reward
                avg_reward = torch.mean(torch.stack([
                    self.reward_model(state, action.unsqueeze(0))
                    for action in sampled_actions
                ]))
                rewards.append(avg_reward)
            
            # Policy gradient update (simplified)
            # In full MaxEnt IRL, this would use value iteration or policy iteration
            loss = -torch.mean(torch.stack(rewards))  # Maximize expected reward
            
            self.policy_optimizer.zero_grad()
            loss.backward()
            self.policy_optimizer.step()
        
        return self.policy
    
    def train(
        self,
        expert_trajectories: List[List[Tuple[np.ndarray, np.ndarray]]],
        num_epochs: int = 50,
        batch_size: int = 64,
        verbose: bool = True,
        callback: callable = None
    ) -> Dict:
        """
        Train reward model using Maximum Entropy IRL.
        
        Args:
            expert_trajectories: List of expert trajectories (your behavior)
            num_epochs: Number of training epochs
            batch_size: Batch size for training
            verbose: Whether to print progress
            
        Returns:
            Training history dictionary
        """
        # Create dataset
        dataset = ExpertTrajectoryDataset(expert_trajectories)
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
        
        history = {
            'loss': [],
            'reward_mean': [],
            'reward_std': []
        }
        
        print(f"\n🚀 Starting MaxEnt IRL Training")
        print(f"   Expert trajectories: {len(expert_trajectories)}")
        print(f"   Total state-action pairs: {len(dataset)}")
        print(f"   Epochs: {num_epochs}")
        print(f"   Batch size: {batch_size}")
        print(f"   Reward model params: {self.reward_model.count_parameters():,}\n")
        
        for epoch in range(num_epochs):
            epoch_losses = []
            epoch_rewards = []
            
            self.reward_model.train()
            
            pbar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{num_epochs}") if verbose else dataloader
            
            for states, actions in pbar:
                states = states.to(self.device)
                actions = actions.to(self.device)
                
                # Forward pass: compute rewards
                predicted_rewards = self.reward_model(states, actions)
                
                # In MaxEnt IRL, we want to maximize likelihood of expert behavior
                # This means expert (state, action) pairs should have high rewards
                # compared to other possible actions
                
                # Compute rewards for expert actions
                expert_rewards = predicted_rewards
                
                # Sample random actions for comparison (negative examples)
                random_actions = torch.randn_like(actions)
                random_rewards = self.reward_model(states, random_actions)
                
                # Loss: expert actions should have higher rewards than random
                # We use a margin-based loss
                margin = 1.0
                loss = torch.mean(torch.clamp(
                    random_rewards - expert_rewards + margin,
                    min=0.0
                ))
                
                # Also add regularization: rewards should be reasonable
                reward_regularization = torch.mean(torch.abs(predicted_rewards))
                loss += 0.01 * reward_regularization
                
                # Backward pass
                self.reward_optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.reward_model.parameters(), 1.0)
                self.reward_optimizer.step()
                
                epoch_losses.append(loss.item())
                epoch_rewards.extend(predicted_rewards.cpu().detach().numpy().flatten())
            
            # Record epoch statistics
            avg_loss = np.mean(epoch_losses)
            avg_reward = np.mean(epoch_rewards)
            std_reward = np.std(epoch_rewards)
            
            history['loss'].append(avg_loss)
            history['reward_mean'].append(avg_reward)
            history['reward_std'].append(std_reward)
            
            # Call callback if provided
            if callback:
                callback(epoch + 1, num_epochs, avg_loss, avg_reward, std_reward)
            
            if verbose:
                print(f"Epoch {epoch+1}/{num_epochs} | "
                      f"Loss: {avg_loss:.4f} | "
                      f"Reward: {avg_reward:.4f} ± {std_reward:.4f}")
        
        print("\n✅ Training complete!")
        return history
    
    def predict_reward(self, state: np.ndarray, action: np.ndarray) -> float:
        """
        Predict reward for a state-action pair.
        
        Args:
            state: State vector
            action: Action vector
            
        Returns:
            Predicted reward value
        """
        self.reward_model.eval()
        
        state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        action_tensor = torch.FloatTensor(action).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            reward = self.reward_model(state_tensor, action_tensor)
            return reward.item()
    
    def save_model(self, path: str):
        """Save trained model."""
        torch.save({
            'reward_model_state_dict': self.reward_model.state_dict(),
            'policy_state_dict': self.policy.state_dict(),
            'state_dim': self.state_dim,
            'action_dim': self.action_dim,
        }, path)
        print(f"✅ Model saved to {path}")
    
    def load_model(self, path: str):
        """Load trained model."""
        checkpoint = torch.load(path, map_location=self.device)
        self.reward_model.load_state_dict(checkpoint['reward_model_state_dict'])
        self.policy.load_state_dict(checkpoint['policy_state_dict'])
        print(f"✅ Model loaded from {path}")



