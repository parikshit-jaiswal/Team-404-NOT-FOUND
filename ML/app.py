import tensorflow as tf
from flask import Flask, request, jsonify
from PIL import Image
import numpy as np
import io

# Load the trained model
model = tf.keras.models.load_model("emotion_model.h5")

# Emotion mapping (from index to emotion name)
emotion_labels = {
    0: "Angry",
    1: "Disgust",
    2: "Fear",
    3: "Happy",
    4: "Sad",
    5: "Surprise",
    6: "Neutral"
}

# Wellness suggestions for emotions
wellness_suggestions = {
    "happy": "Balanced state! Keep following your current routine.",
    "angry": "Pitta imbalance detected. Suggestions: cooling foods like cucumber, meditation, and coconut water.",
    "sad": "Vata imbalance detected. Suggestions: warm milk, sesame oil massage, and grounding exercises.",
    "neutral": "Maintain mindfulness to stay balanced.",
    "fear": "Practice calming techniques such as breathing exercises or guided meditation.",
    "disgust": "Engage in activities that bring joy and relaxation, such as art or nature walks.",
    "surprise": "Take time to process unexpected events mindfully and maintain emotional balance."
}

# Create Flask app
app = Flask(__name__)

# Helper function to process the uploaded image and make a prediction
def prepare_image(image_bytes):
    try:
        # Open the image from bytes
        img = Image.open(io.BytesIO(image_bytes)).convert('L')  # Convert to grayscale
        img = img.resize((48, 48))  # Resize to match model input
        img = np.array(img)  # Convert to numpy array
        img = img.astype("float32") / 255.0  # Normalize pixel values
        img = np.expand_dims(img, axis=-1)  # Add channel dimension (1 for grayscale)
        img = np.expand_dims(img, axis=0)  # Add batch dimension
        return img
    except Exception as e:
        raise ValueError(f"Error processing image: {str(e)}")

# Route for emotion prediction
@app.route('/predict', methods=['POST'])
def predict_emotion():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No file selected for upload"}), 400

    try:
        # Read the image file into memory
        image_bytes = file.read()

        # Prepare the image for prediction
        img = prepare_image(image_bytes)

        # Make prediction using the model
        prediction = model.predict(img)
        predicted_class = np.argmax(prediction)  # Get index of the highest probability
        predicted_emotion = emotion_labels.get(predicted_class, "Unknown")  # Map index to emotion

        # Get wellness suggestion
        wellness_advice = wellness_suggestions.get(predicted_emotion.lower(), "Stay mindful and balanced!")

        # Return prediction and advice
        return jsonify({
            "emotion": predicted_emotion,
            "suggestion": wellness_advice
        })

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)
