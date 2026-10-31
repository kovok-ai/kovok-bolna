import os
import sys
from dotenv import load_dotenv


def main():
    # Load environment variables from project-root .env file
    load_dotenv()

    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key or not api_key.strip():
        print("SARVAM_API_KEY is missing or empty in .env.")
        print("Please add your API key to the .env file in the project root:")
        print("    SARVAM_API_KEY=<your_sarvam_api_subscription_key>")
        sys.exit(1)

    from sarvamai import SarvamAI

    client = SarvamAI(api_subscription_key=api_key.strip())

    response = client.chat.completions(
        model="sarvam-105b-conversations",
        messages=[
            {"role": "user", "content": "Briefly introduce yourself."}
        ]
    )

    if response.choices and response.choices[0].message and response.choices[0].message.content:
        print(response.choices[0].message.content)


if __name__ == "__main__":
    main()
