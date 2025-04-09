# import streamlit as st
# from openai import OpenAI
# from PIL import Image
# import io

# # 🔐 Replace with your actual Perplexity API key
# YOUR_API_KEY = "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"

# # Initialize Perplexity client
# client = OpenAI(api_key=YOUR_API_KEY, base_url="https://api.perplexity.ai")

# # Configure Streamlit page
# st.title("🩻 Medical Image Analysis")
# st.subheader("Upload medical images for AI-powered analysis")

# # File upload widget for medical images
# uploaded_file = st.file_uploader(
#     "Choose medical image",
#     type=["png", "jpg", "jpeg", "dicom"],
#     accept_multiple_files=False,
#     help="Supported formats: PNG, JPG, DICOM"
# )

# if uploaded_file:
#     # Display image preview (non-DICOM only)
#     if uploaded_file.type != "application/dicom":
#         st.image(uploaded_file, caption="Uploaded Image", use_column_width=True)

#     # Prepare image metadata
#     img_metadata = {
#         "filename": uploaded_file.name,
#         "size": f"{len(uploaded_file.getvalue()) / 1024:.2f} KB",
#         "type": uploaded_file.type
#     }

#     # Create analysis prompt
#     analysis_prompt = f"""
#     Analyze this medical image with the following metadata:
#     {img_metadata}
#     Provide detailed medical analysis considering:
#     - Potential abnormalities
#     - Recommended diagnostic steps
#     - Differential diagnoses
#     - Relevant anatomical structures
#     - Possible treatment options
#     """

#     # Generate analysis using Perplexity
#     with st.spinner("Analyzing image with Perplexity AI..."):
#         try:
#             response = client.chat.completions.create(
#                 model="sonar-pro",
#                 messages=[
#                     {"role": "system", "content": "You are a medical imaging specialist. Provide detailed analysis with clinical recommendations."},
#                     {"role": "user", "content": analysis_prompt}
#                 ]
#             )
            
#             analysis = response.choices[0].message.content
#             st.success("Analysis Complete")
#             st.markdown(f"**Diagnostic Report:**\n\n{analysis}")
            
#         except Exception as e:
#             st.error(f"Analysis failed: {str(e)}")







import streamlit as st
import requests
from openai import OpenAI
from PIL import Image
import base64

# --- CONFIGURATION ---
PERPLEXITY_API_KEY = "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"
IMGBB_API_KEY = "deb3712a8512e08aa786c29ad317d455"  # Get from imgbb.com

# Initialize Perplexity API
client = OpenAI(api_key=PERPLEXITY_API_KEY, base_url="https://api.perplexity.ai")

# --- STREAMLIT UI ---
st.title("🩻 Medical Image Analysis with Perplexity")
st.subheader("Upload a medical image and receive AI-based analysis")

uploaded_file = st.file_uploader("Upload Image", type=["png", "jpg", "jpeg"])

if uploaded_file:
    st.image(uploaded_file, caption="Uploaded Image", use_column_width=True)

    # Convert to base64 for imgbb
    image_data = base64.b64encode(uploaded_file.read()).decode("utf-8")

    # Upload to imgbb
    with st.spinner("Uploading image to imgbb..."):
        upload_url = "https://api.imgbb.com/1/upload"
        payload = {
            "key": IMGBB_API_KEY,
            "image": image_data
        }

        response = requests.post(upload_url, data=payload)

        if response.status_code == 200:
            image_url = response.json()["data"]["url"]
            st.success("Image uploaded successfully.")
            st.markdown(f"[View Image]({image_url})")

            # Create the prompt
            prompt = f"""
            You are a medical imaging specialist.

            The user has uploaded the following image for analysis:
            {image_url}

            Assume you can see and interpret this image.

            Please provide:
            - Detailed image-based findings
            - Any abnormalities
            - Differential diagnoses
            - Recommended diagnostic steps or treatments
            """

            with st.spinner("Analyzing image with Perplexity..."):
                try:
                    completion = client.chat.completions.create(
                        model="sonar-deep-research",
                        messages=[
                            {"role": "system", "content": "You are a medical imaging specialist."},
                            {"role": "user", "content": prompt}
                        ]
                    )

                    result = completion.choices[0].message.content
                    st.success("Analysis complete:")
                    st.markdown(result)

                except Exception as e:
                    st.error(f"Perplexity API Error: {e}")
        else:
            st.error("Failed to upload image to imgbb.")
            st.text(response.text)
