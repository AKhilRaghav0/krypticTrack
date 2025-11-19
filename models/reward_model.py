"""
Inverse Reinforcement Learning Reward Model - BEAST ARCHITECTURE 🚀
State-of-the-art neural network with attention, residuals, and modern techniques.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import math


class MultiHeadAttention(nn.Module):
    """Multi-head self-attention mechanism for feature interaction."""
    
    def __init__(self, dim: int, num_heads: int = 8, dropout: float = 0.1):
        super().__init__()
        assert dim % num_heads == 0
        
        self.dim = dim
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.scale = self.head_dim ** -0.5
        
        self.qkv = nn.Linear(dim, dim * 3, bias=False)
        self.proj = nn.Linear(dim, dim)
        self.dropout = nn.Dropout(dropout)
        self.norm = nn.LayerNorm(dim)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, N, C = x.shape
        residual = x
        
        # Layer norm
        x = self.norm(x)
        
        # QKV projection
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim).permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]
        
        # Attention
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)
        attn = self.dropout(attn)
        
        # Apply attention to values
        x = (attn @ v).transpose(1, 2).reshape(B, N, C)
        x = self.proj(x)
        x = self.dropout(x)
        
        # Residual connection
        return x + residual


class FeedForward(nn.Module):
    """Feed-forward network with GELU and dropout."""
    
    def __init__(self, dim: int, hidden_dim: int = None, dropout: float = 0.1):
        super().__init__()
        hidden_dim = hidden_dim or dim * 4
        
        self.net = nn.Sequential(
            nn.Linear(dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, dim),
            nn.Dropout(dropout)
        )
        self.norm = nn.LayerNorm(dim)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        x = self.norm(x)
        return self.net(x) + residual


class TransformerBlock(nn.Module):
    """Transformer block with attention and feed-forward."""
    
    def __init__(self, dim: int, num_heads: int = 8, dropout: float = 0.1):
        super().__init__()
        self.attention = MultiHeadAttention(dim, num_heads, dropout)
        self.ffn = FeedForward(dim, dropout=dropout)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.attention(x)
        x = self.ffn(x)
        return x


class ResidualBlock(nn.Module):
    """Residual block with layer norm and GELU."""
    
    def __init__(self, dim: int, dropout: float = 0.1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(dim, dim),
            nn.LayerNorm(dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(dim, dim),
            nn.Dropout(dropout)
        )
        self.norm = nn.LayerNorm(dim)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(self.norm(x)) + x


class CrossAttention(nn.Module):
    """Cross-attention between state and action features."""
    
    def __init__(self, state_dim: int, action_dim: int, hidden_dim: int, num_heads: int = 4):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.num_heads = num_heads
        self.head_dim = hidden_dim // num_heads
        self.scale = self.head_dim ** -0.5
        
        # Projections
        self.state_proj = nn.Linear(state_dim, hidden_dim)
        self.action_proj = nn.Linear(action_dim, hidden_dim)
        self.q_proj = nn.Linear(hidden_dim, hidden_dim)
        self.k_proj = nn.Linear(hidden_dim, hidden_dim)
        self.v_proj = nn.Linear(hidden_dim, hidden_dim)
        self.out_proj = nn.Linear(hidden_dim, hidden_dim)
        
        self.norm = nn.LayerNorm(hidden_dim)
        
    def forward(self, state: torch.Tensor, action: torch.Tensor) -> torch.Tensor:
        B = state.shape[0]
        
        # Project to common dimension
        state_feat = self.state_proj(state).unsqueeze(1)  # [B, 1, hidden_dim]
        action_feat = self.action_proj(action).unsqueeze(1)  # [B, 1, hidden_dim]
        
        # Concatenate
        x = torch.cat([state_feat, action_feat], dim=1)  # [B, 2, hidden_dim]
        
        # Cross-attention: state attends to action and vice versa
        q = self.q_proj(x).reshape(B, 2, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).reshape(B, 2, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).reshape(B, 2, self.num_heads, self.head_dim).transpose(1, 2)
        
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)
        
        x = (attn @ v).transpose(1, 2).reshape(B, 2, self.hidden_dim)
        x = self.out_proj(x)
        x = self.norm(x)
        
        # Pool to single vector
        x = x.mean(dim=1)  # [B, hidden_dim]
        return x


class RewardModel(nn.Module):
    """
    BEAST Reward Model - State-of-the-art architecture 🚀
    
    Architecture:
    - Separate state/action encoders with residual blocks
    - Cross-attention for state-action interaction
    - Transformer blocks for feature refinement
    - Deep residual network for final reward prediction
    - Total params: ~3-5M (efficient but powerful)
    """
    
    def __init__(self, state_dim: int = 192, action_dim: int = 48, hidden_dims: list = None):
        """
        Initialize BEAST reward model.
        
        Args:
            state_dim: Dimension of state vector
            action_dim: Dimension of action vector
            hidden_dims: List of hidden layer dimensions (default: [512, 256, 128])
        """
        super(RewardModel, self).__init__()
        
        self.state_dim = state_dim
        self.action_dim = action_dim
        
        # Default hidden dimensions (larger for more capacity)
        if hidden_dims is None:
            hidden_dims = [512, 256, 128]
        
        hidden_dim = hidden_dims[0]
        
        # === STATE ENCODER (with residual blocks) ===
        self.state_encoder = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            ResidualBlock(hidden_dim),
            ResidualBlock(hidden_dim),
        )
        
        # === ACTION ENCODER (with residual blocks) ===
        self.action_encoder = nn.Sequential(
            nn.Linear(action_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            ResidualBlock(hidden_dim),
        )
        
        # === CROSS-ATTENTION (state-action interaction) ===
        self.cross_attention = CrossAttention(
            state_dim=hidden_dim,
            action_dim=hidden_dim,
            hidden_dim=hidden_dim,
            num_heads=8
        )
        
        # === TRANSFORMER BLOCKS (feature refinement) ===
        self.transformer_blocks = nn.Sequential(
            TransformerBlock(hidden_dim, num_heads=8),
            TransformerBlock(hidden_dim, num_heads=8),
        )
        
        # === DEEP RESIDUAL NETWORK (reward prediction) ===
        layers = []
        prev_dim = hidden_dim
        
        for hidden_dim_next in hidden_dims[1:]:
            layers.append(ResidualBlock(prev_dim))
            layers.append(nn.Linear(prev_dim, hidden_dim_next))
            layers.append(nn.LayerNorm(hidden_dim_next))
            layers.append(nn.GELU())
            layers.append(nn.Dropout(0.1))
            prev_dim = hidden_dim_next
        
        # Final residual block
        layers.append(ResidualBlock(prev_dim))
        
        self.reward_network = nn.Sequential(*layers)
        
        # === OUTPUT LAYER ===
        self.output = nn.Sequential(
            nn.Linear(prev_dim, 64),
            nn.LayerNorm(64),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(64, 1)
        )
        
        # Initialize weights
        self._initialize_weights()
    
    def _initialize_weights(self):
        """Initialize network weights using advanced techniques."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                # Kaiming initialization for better gradient flow
                nn.init.kaiming_normal_(module.weight, mode='fan_out', nonlinearity='relu')
                if module.bias is not None:
                    nn.init.constant_(module.bias, 0.0)
            elif isinstance(module, (nn.LayerNorm, nn.BatchNorm1d)):
                nn.init.constant_(module.weight, 1.0)
                nn.init.constant_(module.bias, 0.0)
    
    def forward(self, state: torch.Tensor, action: torch.Tensor) -> torch.Tensor:
        """
        Forward pass: compute reward R(s, a) with BEAST architecture.
        
        Args:
            state: State tensor [batch_size, state_dim]
            action: Action tensor [batch_size, action_dim]
            
        Returns:
            Reward tensor [batch_size, 1]
        """
        # Encode state and action separately
        state_feat = self.state_encoder(state)  # [B, hidden_dim]
        action_feat = self.action_encoder(action)  # [B, hidden_dim]
        
        # Cross-attention: learn state-action interactions
        fused_feat = self.cross_attention(state_feat, action_feat)  # [B, hidden_dim]
        
        # Add residual connection from state
        fused_feat = fused_feat + state_feat
        
        # Transformer blocks: refine features with self-attention
        # Reshape for transformer (needs sequence dimension)
        fused_feat = fused_feat.unsqueeze(1)  # [B, 1, hidden_dim]
        refined_feat = self.transformer_blocks(fused_feat)  # [B, 1, hidden_dim]
        refined_feat = refined_feat.squeeze(1)  # [B, hidden_dim]
        
        # Deep residual network for reward prediction
        reward_feat = self.reward_network(refined_feat)  # [B, final_dim]
        
        # Final output
        reward = self.output(reward_feat)  # [B, 1]
        
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
    BEAST Policy Network - Enhanced architecture.
    Learns optimal policy π(a|s) given reward function.
    """
    
    def __init__(self, state_dim: int = 192, action_dim: int = 48, hidden_dims: list = None):
        """
        Initialize BEAST policy network.
        
        Args:
            state_dim: Dimension of state vector
            action_dim: Dimension of action vector (output)
            hidden_dims: List of hidden layer dimensions
        """
        super(PolicyNetwork, self).__init__()
        
        self.state_dim = state_dim
        self.action_dim = action_dim
        
        if hidden_dims is None:
            hidden_dims = [512, 256]
        
        # Build network with residual blocks
        layers = []
        prev_dim = state_dim
        
        for hidden_dim in hidden_dims:
            layers.append(nn.Linear(prev_dim, hidden_dim))
            layers.append(nn.LayerNorm(hidden_dim))
            layers.append(nn.GELU())
            layers.append(ResidualBlock(hidden_dim))
            layers.append(nn.Dropout(0.1))
            prev_dim = hidden_dim
        
        self.network = nn.Sequential(*layers)
        
        # Output layer: action probabilities
        self.output = nn.Sequential(
            nn.Linear(prev_dim, action_dim),
            nn.LayerNorm(action_dim),
            nn.Softmax(dim=-1)
        )
        
        # Initialize weights
        self._initialize_weights()
    
    def _initialize_weights(self):
        """Initialize network weights."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.kaiming_normal_(module.weight, mode='fan_out', nonlinearity='relu')
                if module.bias is not None:
                    nn.init.constant_(module.bias, 0.0)
            elif isinstance(module, nn.LayerNorm):
                nn.init.constant_(module.weight, 1.0)
                nn.init.constant_(module.bias, 0.0)
    
    def forward(self, state: torch.Tensor) -> torch.Tensor:
        """
        Forward pass: compute action probabilities π(a|s).
        
        Args:
            state: State tensor [batch_size, state_dim]
            
        Returns:
            Action probabilities [batch_size, action_dim]
        """
        x = self.network(state)
        return self.output(x)
    
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
