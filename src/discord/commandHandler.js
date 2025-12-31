const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

const createCommandHandler = (client) => {
  const commands = new Collection();

  const loadCommands = () => {
    const commandsPath = path.join(__dirname, '../commands');

    try {
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

      commandFiles.forEach(file => {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if('data' in command && 'execute' in command) {
          commands.set(command.data.name, command);
          console.log(`[Commands] Loaded: ${command.data.name}`);
        } else {
          console.warn(`[Commands] Warning: ${file} is missing required properties`);
        }
      });

      console.log(`[Commands] Successfully loaded ${commands.size} commands`);
    } catch(error) {
      console.error('[Commands] Error loading commands:', error);
    }
  };

  const handleInteraction = async (interaction) => {
    if(!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);

    if(!command) {
      console.error(`[Commands] No command matching ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch(error) {
      console.error(`[Commands] Error executing ${interaction.commandName}:`, error);

      const errorMessage = 'There was an error executing this command!';

      if(interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  };

  const registerCommands = async () => {
    try {
      console.log('[Commands] Registering slash commands...');

      const commandData = [...commands.values()].map(cmd => cmd.data.toJSON());
      await client.application.commands.set(commandData);

      console.log(`[Commands] Successfully registered ${commandData.length} slash commands`);
    } catch(error) {
      console.error('[Commands] Error registering slash commands:', error);
    }
  };

  loadCommands();
  client.on('interactionCreate', handleInteraction);

  return { registerCommands, commands };
};

module.exports = createCommandHandler;
