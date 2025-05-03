# Chat Webhook

This project is a webhook service designed to handle chat-related events and interactions.

## Features

- Process incoming chat messages.
- Integrate with third-party chat platforms.
- Provide real-time event handling.

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/your-username/chat-webhook.git
    ```
2. Navigate to the project directory:
    ```bash
    cd chat-webhook
    ```
3. Install dependencies:
    ```bash
    pnpm install
    ```

## Token Generation

1. Run this in order to generate token.json file or if the refresh token is expired. In case of error, try deleting the token.json file and running this again. Make sure to run this with the app listening on localhost:3000
    ```bash
    pnpm auth
    ```

## Usage

1. Start the server:
    ```bash
    pnpm dev
    ```
2. Configure your chat platform to send events to the webhook URL:
    ```
    http://your-server-address/webhook
    ```

## Configuration

Update the `.env` file with your environment variables:
```env
PORT=3000
CHAT_API_KEY=your_api_key
```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).