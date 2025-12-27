// Configuration de l'API Admin pour Manage Documentation
// Cloudflare Worker avec authentification et gestion de contenu

const ADMIN_API_KEY = 'Manage@@@'; // À changer impérativement

// Structure de données pour stocker le contenu
const CONTENT_STRUCTURE = {
  pages: {
    intro: {
      id: 'intro',
      title: '📘 Lisez-moi',
      version: '1.6',
      content: {},
      metadata: { lastUpdate: new Date().toISOString() }
    },
    install: {
      id: 'install',
      title: '🛠️ Installation',
      version: '1.5',
      content: {},
      metadata: { lastUpdate: new Date().toISOString() }
    },
    news: {
      id: 'news',
      title: '✨ Nouveautés',
      version: '1.6',
      content: {},
      metadata: { lastUpdate: new Date().toISOString() }
    },
    general: {
      id: 'gen',
      title: '⚙️ Général',
      content: {},
      metadata: { lastUpdate: new Date().toISOString() }
    },
    infini: {
      id: 'inf',
      title: '♾️ Infini',
      content: {},
      metadata: { lastUpdate: new Date().toISOString() }
    },
    welcome: {
      id: 'wel',
      title: '👋 Bienvenue',
      content: {},
      metadata: { lastUpdate: new Date().toISOString() }
    },
    economy: {
      id: 'eco',
      title: '💰 Économie',
      content: {},
      metadata: { lastUpdate: new Date().toISOString() }
    },
    commands: {
      id: 'cmd',
      title: '⌨️ Commandes',
      content: {},
      metadata: { lastUpdate: new Date().toISOString() }
    }
  },
  config: {
    botName: 'Manage',
    version: '1.6',
    logoUrl: 'https://i.postimg.cc/x8kQQ2fq/Manage-2-0.png',
    inviteUrl: 'https://discord.com/oauth2/authorize?client_id=1431421654038351942&permissions=8&integration_type=0&scope=bot+applications.commands',
    primaryColor: '#773bef'
  }
};

// Middleware d'authentification
function authenticate(request) {
  const apiKey = request.headers.get('X-API-Key');
  return apiKey === ADMIN_API_KEY;
}

// Fonction pour générer des réponses JSON
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
    }
  });
}

// Handler principal
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
        }
      });
    }

    // Routes publiques (pas d'authentification requise)
    if (path === '/' || path === '/health') {
      return jsonResponse({
        status: 'online',
        service: 'Manage Admin API',
        version: '1.0.0',
        endpoints: {
          public: ['/health', '/api/pages', '/api/config'],
          admin: ['/api/admin/pages', '/api/admin/config', '/api/admin/pages/create']
        }
      });
    }

    // GET /api/pages - Récupérer toutes les pages (public)
    if (path === '/api/pages' && method === 'GET') {
      const pages = await env.MANAGE_KV.get('pages', { type: 'json' }) || CONTENT_STRUCTURE.pages;
      return jsonResponse({ success: true, data: pages });
    }

    // GET /api/pages/:id - Récupérer une page spécifique (public)
    if (path.startsWith('/api/pages/') && method === 'GET') {
      const pageId = path.split('/').pop();
      const pages = await env.MANAGE_KV.get('pages', { type: 'json' }) || CONTENT_STRUCTURE.pages;
      const page = Object.values(pages).find(p => p.id === pageId);
      
      if (!page) {
        return jsonResponse({ success: false, error: 'Page non trouvée' }, 404);
      }
      
      return jsonResponse({ success: true, data: page });
    }

    // GET /api/config - Récupérer la configuration (public)
    if (path === '/api/config' && method === 'GET') {
      const config = await env.MANAGE_KV.get('config', { type: 'json' }) || CONTENT_STRUCTURE.config;
      return jsonResponse({ success: true, data: config });
    }

    // === ROUTES ADMIN (authentification requise) ===
    if (!authenticate(request)) {
      return jsonResponse({ success: false, error: 'Non autorisé - Clé API invalide' }, 401);
    }

    // POST /api/admin/pages/create - Créer une nouvelle page
    if (path === '/api/admin/pages/create' && method === 'POST') {
      try {
        const body = await request.json();
        const { id, title, content, version } = body;

        if (!id || !title) {
          return jsonResponse({ success: false, error: 'ID et titre requis' }, 400);
        }

        const pages = await env.MANAGE_KV.get('pages', { type: 'json' }) || CONTENT_STRUCTURE.pages;
        
        if (pages[id]) {
          return jsonResponse({ success: false, error: 'Cette page existe déjà' }, 409);
        }

        pages[id] = {
          id,
          title,
          version: version || '1.0',
          content: content || {},
          metadata: {
            created: new Date().toISOString(),
            lastUpdate: new Date().toISOString()
          }
        };

        await env.MANAGE_KV.put('pages', JSON.stringify(pages));

        return jsonResponse({
          success: true,
          message: 'Page créée avec succès',
          data: pages[id]
        }, 201);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // PUT /api/admin/pages/:id - Mettre à jour une page
    if (path.startsWith('/api/admin/pages/') && method === 'PUT') {
      try {
        const pageId = path.split('/').pop();
        const body = await request.json();
        const pages = await env.MANAGE_KV.get('pages', { type: 'json' }) || CONTENT_STRUCTURE.pages;

        const page = Object.values(pages).find(p => p.id === pageId);
        if (!page) {
          return jsonResponse({ success: false, error: 'Page non trouvée' }, 404);
        }

        // Mise à jour des champs
        const pageKey = Object.keys(pages).find(key => pages[key].id === pageId);
        pages[pageKey] = {
          ...pages[pageKey],
          ...body,
          metadata: {
            ...pages[pageKey].metadata,
            lastUpdate: new Date().toISOString()
          }
        };

        await env.MANAGE_KV.put('pages', JSON.stringify(pages));

        return jsonResponse({
          success: true,
          message: 'Page mise à jour avec succès',
          data: pages[pageKey]
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // DELETE /api/admin/pages/:id - Supprimer une page
    if (path.startsWith('/api/admin/pages/') && method === 'DELETE') {
      try {
        const pageId = path.split('/').pop();
        const pages = await env.MANAGE_KV.get('pages', { type: 'json' }) || CONTENT_STRUCTURE.pages;

        const pageKey = Object.keys(pages).find(key => pages[key].id === pageId);
        if (!pageKey) {
          return jsonResponse({ success: false, error: 'Page non trouvée' }, 404);
        }

        delete pages[pageKey];
        await env.MANAGE_KV.put('pages', JSON.stringify(pages));

        return jsonResponse({
          success: true,
          message: 'Page supprimée avec succès'
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // PUT /api/admin/config - Mettre à jour la configuration
    if (path === '/api/admin/config' && method === 'PUT') {
      try {
        const body = await request.json();
        const currentConfig = await env.MANAGE_KV.get('config', { type: 'json' }) || CONTENT_STRUCTURE.config;

        const newConfig = {
          ...currentConfig,
          ...body,
          lastUpdate: new Date().toISOString()
        };

        await env.MANAGE_KV.put('config', JSON.stringify(newConfig));

        return jsonResponse({
          success: true,
          message: 'Configuration mise à jour',
          data: newConfig
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // POST /api/admin/pages/:id/section - Ajouter une section à une page
    if (path.match(/\/api\/admin\/pages\/[^/]+\/section$/) && method === 'POST') {
      try {
        const pageId = path.split('/')[4];
        const body = await request.json();
        const { sectionTitle, sectionContent, sectionType } = body;

        const pages = await env.MANAGE_KV.get('pages', { type: 'json' }) || CONTENT_STRUCTURE.pages;
        const pageKey = Object.keys(pages).find(key => pages[key].id === pageId);

        if (!pageKey) {
          return jsonResponse({ success: false, error: 'Page non trouvée' }, 404);
        }

        if (!pages[pageKey].content.sections) {
          pages[pageKey].content.sections = [];
        }

        pages[pageKey].content.sections.push({
          id: Date.now().toString(),
          title: sectionTitle,
          content: sectionContent,
          type: sectionType || 'text',
          created: new Date().toISOString()
        });

        pages[pageKey].metadata.lastUpdate = new Date().toISOString();

        await env.MANAGE_KV.put('pages', JSON.stringify(pages));

        return jsonResponse({
          success: true,
          message: 'Section ajoutée avec succès',
          data: pages[pageKey]
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // GET /api/admin/stats - Statistiques admin
    if (path === '/api/admin/stats' && method === 'GET') {
      const pages = await env.MANAGE_KV.get('pages', { type: 'json' }) || CONTENT_STRUCTURE.pages;
      const config = await env.MANAGE_KV.get('config', { type: 'json' }) || CONTENT_STRUCTURE.config;

      return jsonResponse({
        success: true,
        data: {
          totalPages: Object.keys(pages).length,
          version: config.version,
          lastUpdate: Object.values(pages).reduce((latest, page) => {
            return new Date(page.metadata.lastUpdate) > new Date(latest) 
              ? page.metadata.lastUpdate 
              : latest;
          }, new Date(0).toISOString())
        }
      });
    }

    // Route non trouvée
    return jsonResponse({ success: false, error: 'Route non trouvée' }, 404);
  }
};
