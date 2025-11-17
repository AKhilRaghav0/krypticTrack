"""
Inverse Reinforcement Learning Reward Model.
Small neural network (3-5 layers, ~1-5M params) that learns reward function.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class RewardModel(nn.Module):
    """
    Neural network that learns reward function R(s, a).
    
    Architecture:
    - Input: State (192 dim) + Action (48 dim) = 240 dim
    - Hidden layers: 256 → 128 → 64
    - Output: Scalar reward value
    
    Total params: ~1-2M (depending on exact dimensions)
    """
    
    def __init__(self, state_dim: int = 192, action_dim: int = 48, hidden_dims: list = None):
        """
        Initialize reward model.
        
        Args:
            state_dim: Dimension of state vector
            action_dim: Dimension of action vector
            hidden_dims: List of hidden layer dimensions (default: [256, 128, 64])
        """
        super(RewardModel, self).__init__()
        
        self.state_dim = state_dim
        self.action_dim = action_dim
        input_dim = state_dim + action_dim
        
        # Default hidden dimensions
        if hidden_dims is None:
            hidden_dims = [256, 128, 64]
        
        # Build network layers
        layers = []
        prev_dim = input_dim
        
        for i, hidden_dim in enumerate(hidden_dims):
            layers.append(nn.Linear(prev_dim, hidden_dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(0.2))
            layers.append(nn.LayerNorm(hidden_dim))
            prev_dim = hidden_dim
        
        # Output layer (single scalar reward)
        layers.append(nn.Linear(prev_dim, 1))
        
        self.network = nn.Sequential(*layers)
        
        # Initialize weights
        self._initialize_weights()
    
    def _initialize_weights(self):
        """Initialize network weights using Xavier uniform."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
    
    def forward(self, state: torch.Tensor, action: torch.Tensor) -> torch.Tensor:
        """
        Forward pass: compute reward R(s, a).
        
        Args:
            state: State tensor [batch_size, state_dim]
            action: Action tensor [batch_size, action_dim]
            
        Returns:
            Reward tensor [batch_size, 1]
        """
        # Concatenate state and action
        x = torch.cat([state, action], dim=-1)
        
        # Forward through network
        reward = self.network(x)
        
        return reward
    
    def get_reward(self, state: torch.Tensor, action: torch.Tensor) -> float:
        """
        Get reward for single state-action pair (for inference).
        
        Args:
            state: State tensor [state_dim]
            action: Action tensor [action_dim]
            
        Returns:
            Scalar reward value
        """
        self.eval()
        with torch.no_grad():
            # Add batch dimension
            state = state.unsqueeze(0)
            action = action.unsqueeze(0)
            reward = self.forward(state, action)
            return reward.item()
    
    def count_parameters(self) -> int:
        """Count total number of trainable parameters."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


class PolicyNetwork(nn.Module):
    """
    Policy network for Maximum Entropy IRL.
    Learns optimal policy π(a|s) given reward function.
    """
    
    def __init__(self, state_dim: int = 192, action_dim: int = 48, hidden_dims: list = None):
        """
        Initialize policy network.
        
        Args:
            state_dim: Dimension of state vector
            action_dim: Dimension of action vector (output)
            hidden_dims: List of hidden layer dimensions
        """
        super(PolicyNetwork, self).__init__()
        
        self.state_dim = state_dim
        self.action_dim = action_dim
        
        if hidden_dims is None:
            hidden_dims = [256, 128]
        
        # Build network
        layers = []
        prev_dim = state_dim
        
        for hidden_dim in hidden_dims:
            layers.append(nn.Linear(prev_dim, hidden_dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(0.1))
            prev_dim = hidden_dim
        
        # Output layer: action probabilities
        layers.append(nn.Linear(prev_dim, action_dim))
        layers.append(nn.Softmax(dim=-1))
        
        self.network = nn.Sequential(*layers)
    
    def forward(self, state: torch.Tensor) -> torch.Tensor:
        """
        Forward pass: compute action probabilities π(a|s).
        
        Args:
            state: State tensor [batch_size, state_dim]
            
        Returns:
            Action probabilities [batch_size, action_dim]
        """
        return self.network(state)
    
    def sample_action(self, state: torch.Tensor) -> torch.Tensor:
        """
        Sample action from policy.
        
        Args:
            state: State tensor [state_dim] or [batch_size, state_dim]
            
        Returns:
            Sampled action index [batch_size]
        """
        probs = self.forward(state)
        dist = torch.distributions.Categorical(probs)
        return dist.sample()



