"""
LLM Service for Chat and Suggestions
Uses LM Studio for privacy-first AI interactions and IRL prediction explanations
"""

import requests
import json
from typing import Dict, List, Optional
from datetime import datetime


class LLMService:
    """Service for interacting with LM Studio."""
    
    def __init__(self, base_url: str = 'http://localhost:1234', model: str = 'local-model'):
        self.base_url = base_url
        self.chat_url = f'{base_url}/v1/chat/completions'
        self.model = model
        self.conversation_history: List[Dict] = []
        self.user_context: Dict = {}
    
    def is_available(self) -> bool:
        """Check if LM Studio is running."""
        try:
            response = requests.get(f'{self.base_url}/v1/models', timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def load_user_context(self, db_connection, user_id: Optional[str] = None):
        """Load user behavior context from database."""
        cursor = db_connection.cursor()
        
        # Get recent actions summary
        cursor.execute("""
            SELECT source, action_type, COUNT(*) as count
            FROM actions
            GROUP BY source, action_type
            ORDER BY count DESC
            LIMIT 20
        """)
        
        top_actions = cursor.fetchall()
        
        # Get hourly activity for productive hours
        cursor.execute("""
            SELECT 
                strftime('%H', datetime(timestamp, 'unixepoch')) as hour,
                COUNT(*) as count
            FROM actions
            GROUP BY hour
            ORDER BY count DESC
            LIMIT 5
        """)
        peak_hours = cursor.fetchall()
        
        self.user_context = {
            'top_actions': [{'source': r[0], 'action_type': r[1], 'count': r[2]} for r in top_actions],
            'total_actions': sum(r[2] for r in top_actions),
            'peak_hours': [{'hour': int(r[0]), 'count': r[1]} for r in peak_hours] if peak_hours else []
        }
    
    def chat(self, message: str, context: Optional[Dict] = None) -> str:
        """Chat with the LLM about user behavior."""
        if not self.is_available():
            raise Exception("LLM service is not available. Please start LM Studio and ensure a model is loaded.")
        
        # Build context prompt with real data
        context_prompt = ""
        if self.user_context:
            peak_hours = self.user_context.get('peak_hours', [])
            peak_hours_str = ""
            if peak_hours:
                hour_strings = []
                for h in peak_hours[:3]:
                    hour_str = f"{h['hour']}:00 ({h['count']} actions)"
                    hour_strings.append(hour_str)
                peak_hours_str = f"\n- Most productive hours: {', '.join(hour_strings)}"
            
            context_prompt = f"""
You are an AI assistant helping analyze user behavior data. Here's the user's context:
- Total actions tracked: {self.user_context.get('total_actions', 0)}
- Top activities: {json.dumps(self.user_context.get('top_actions', [])[:5], indent=2)}{peak_hours_str}

When asked about productive hours, peak times, or activity patterns, use the data above to provide specific, accurate answers.

"""
        
        # Build messages array for LM Studio
        messages = [
            {
                "role": "system",
                "content": "You are an AI assistant for KrypticTrack, a behavior analytics platform. Help users understand their behavior patterns in a friendly, insightful way."
            }
        ]
        
        # Add conversation history
        for msg in self.conversation_history[-5:]:  # Last 5 messages
            messages.append({"role": "user", "content": msg['user']})
            messages.append({"role": "assistant", "content": msg['assistant']})
        
        # Add current message
        messages.append({"role": "user", "content": f"{context_prompt}{message}"})
        
        try:
            response = requests.post(
                self.chat_url,
                json={
                    'model': self.model,
                    'messages': messages,
                    'temperature': 0.7,
                    'max_tokens': 500,
                    'stream': False
                },
                timeout=120  # Increased for slower models like gemma
            )
            
            if response.status_code == 200:
                result = response.json()
                if 'choices' in result and len(result['choices']) > 0:
                    assistant_message = result['choices'][0]['message']['content'].strip()
                    
                    # Save to history
                    self.conversation_history.append({
                        'user': message,
                        'assistant': assistant_message,
                        'timestamp': datetime.now().isoformat()
                    })
                    
                    return assistant_message
                else:
                    raise Exception(f"Invalid response format: {result}")
            else:
                error_text = response.text[:200] if response.text else "Unknown error"
                raise Exception(f"LLM API returned {response.status_code}: {error_text}")
        except requests.exceptions.Timeout:
            raise Exception("Request timed out. The model is taking too long to respond. Try a lighter model or increase timeout.")
        except requests.exceptions.ConnectionError:
            raise Exception("Cannot connect to LM Studio. Make sure LM Studio is running on http://localhost:1234")
        except Exception as e:
            raise Exception(f"LLM error: {str(e)}")
    
    def generate_surprised_me_insight(self, behavior_data: Dict) -> str:
        """Generate a surprising but true insight about user behavior."""
        if not self.is_available():
            return None
        
        prompt = f"""Generate a surprising but TRUE insight about this user's behavior. Make it specific, unexpected, and backed by data.

Behavior Data:
{json.dumps(behavior_data, indent=2)}

Rules:
- Be specific with numbers and percentages
- Make it surprising but true
- Use second person ("you")
- Keep it to 1-2 sentences
- Make it feel personal and insightful
- Examples: "You coded 47% more on rainy days", "You're most creative at 2 AM", "You check social media exactly 8 minutes after getting stuck"

Generate ONE surprising insight:"""
        
        try:
            response = requests.post(
                self.chat_url,
                json={
                    'model': self.model,
                    'messages': [
                        {
                            "role": "system",
                            "content": "You are a behavior analyst who finds surprising but true patterns in user data. Be specific, unexpected, and accurate."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    'temperature': 0.9,  # Higher for more creativity
                    'max_tokens': 150,
                    'stream': False
                },
                timeout=120  # Increased for slower models
            )
            
            if response.status_code == 200:
                result = response.json()
                return result['choices'][0]['message']['content'].strip()
        except:
            pass
        
        return None
    
    def generate_suggestion(self, behavior_data: Dict) -> str:
        """Generate personalized suggestions based on behavior."""
        if not self.is_available():
            return None
        
        prompt = f"""Based on this user behavior data, provide a personalized productivity suggestion:
{json.dumps(behavior_data, indent=2)}

Provide a brief, actionable suggestion (1-2 sentences):"""
        
        try:
            response = requests.post(
                self.chat_url,
                json={
                    'model': self.model,
                    'messages': [
                        {
                            "role": "system",
                            "content": "You are a productivity coach. Give actionable, specific suggestions based on behavior data."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    'temperature': 0.8,
                    'max_tokens': 200,
                    'stream': False
                },
                timeout=120  # Increased for slower models
            )
            
            if response.status_code == 200:
                result = response.json()
                return result['choices'][0]['message']['content'].strip()
        except:
            pass
        
        return None
    
    def analyze_behavior(self, insights: List[Dict]) -> str:
        """Analyze behavior insights and provide summary."""
        if not self.is_available():
            return None
        
        prompt = f"""Analyze these behavior insights and provide a brief analysis:
{json.dumps(insights, indent=2)}

Provide a 2-3 sentence analysis of the user's behavior patterns:"""
        
        try:
            response = requests.post(
                self.chat_url,
                json={
                    'model': self.model,
                    'messages': [
                        {
                            "role": "system",
                            "content": "You are a behavior analyst. Analyze patterns and provide clear insights."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    'temperature': 0.7,
                    'max_tokens': 300,
                    'stream': False
                },
                timeout=120  # Increased for slower models
            )
            
            if response.status_code == 200:
                result = response.json()
                return result['choices'][0]['message']['content'].strip()
        except:
            pass
        
        return None
    
    def explain_prediction(self, prediction_data: Dict) -> str:
        """
        Generate natural language explanation for IRL prediction.
        
        prediction_data = {
            'current_state': {...},
            'predicted_action': 'switch_to_browser',
            'confidence': 0.78,
            'recent_history': [...],
            'context': {...}
        }
        """
        if not self.is_available():
            return f"Prediction: {prediction_data['predicted_action']} ({prediction_data['confidence']:.0%} confident)"
        
        # Build context prompt
        current_state = prediction_data.get('current_state', {})
        predicted_action = prediction_data.get('predicted_action', 'unknown')
        confidence = prediction_data.get('confidence', 0.0)
        recent_history = prediction_data.get('recent_history', [])
        time_estimate = prediction_data.get('time_estimate', 'soon')
        
        # Format recent history
        history_str = "\n".join([
            f"- {h.get('action', 'unknown')} ({h.get('time_ago', 'recent')})"
            for h in recent_history[-5:]
        ]) if recent_history else "No recent history"
        
        prompt = f"""Explain this behavior prediction in 1-2 sentences:

Current Activity:
- App: {current_state.get('app', 'Unknown')}
- Duration: {current_state.get('duration_minutes', 0)} minutes
- Context: {current_state.get('context', 'Unknown')}

Recent Actions:
{history_str}

Prediction:
- Next action: {predicted_action.replace('_', ' ')}
- Confidence: {confidence:.0%}
- Time estimate: {time_estimate}

Based on the user's historical patterns, explain WHY this prediction makes sense. Use second person ("you"). Be specific and reference the patterns."""
        
        try:
            response = requests.post(
                self.chat_url,
                json={
                    'model': self.model,
                    'messages': [
                        {
                            "role": "system",
                            "content": """You are an AI behavior analyst for KrypticTrack. Your job is to explain predictions about user behavior in clear, concise natural language.

Rules:
- Be direct and specific
- Use second person ("you")
- Mention confidence levels
- Reference patterns from history
- Keep explanations under 2 sentences
- Sound insightful but not creepy
- Be casual but professional

Example:
Input: User coding for 45 min, model predicts browser switch (78% confident)
Output: "You'll likely switch to your browser in the next 3 minutes (78% confident) because you typically take a break or search for solutions after 40-50 minutes of continuous coding."
"""
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    'temperature': 0.7,
                    'max_tokens': 200,
                    'stream': False
                },
                timeout=120  # Increased for slower models
            )
            
            if response.status_code == 200:
                result = response.json()
                explanation = result['choices'][0]['message']['content'].strip()
                return explanation
            else:
                return f"Prediction: {predicted_action.replace('_', ' ')} ({confidence:.0%} confident)"
        except Exception as e:
            return f"Prediction: {predicted_action.replace('_', ' ')} ({confidence:.0%} confident)"


# Global instance
_llm_service = None

def get_llm_service() -> LLMService:
    """Get global LLM service instance."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service

